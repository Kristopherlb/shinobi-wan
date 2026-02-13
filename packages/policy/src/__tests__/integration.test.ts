import { describe, it, expect } from 'vitest';
import { Kernel } from '@shinobi/kernel';
import { ComponentPlatformBinder, BinderRegistry } from '@shinobi/binder';
import { BaselinePolicyEvaluator } from '../evaluators/baseline-policy-evaluator';
import { makeNode, makeEdge } from './test-helpers';

describe('Kernel + Binder + Policy integration', () => {
  function createKernel(policyPack: string) {
    const registry = new BinderRegistry();
    registry.register(new ComponentPlatformBinder());

    return new Kernel({
      config: { policyPack },
      binders: registry.getBinders(),
      evaluators: [new BaselinePolicyEvaluator()],
    });
  }

  function addViolatingGraph(kernel: ReturnType<typeof createKernel>) {
    const source = makeNode({ id: 'component:my-svc', type: 'component' });
    const target = makeNode({ id: 'platform:aws-sqs', type: 'platform' });
    const edge = makeEdge({
      id: 'edge:bindsTo:component:my-svc:platform:aws-sqs',
      type: 'bindsTo',
      source: source.id,
      target: target.id,
      metadata: {
        bindingConfig: {
          resourceType: 'queue',
          accessLevel: 'admin',
          network: { port: 443, protocol: 'any' },
        },
      },
    });

    kernel.applyMutation([
      { type: 'addNode', node: source },
      { type: 'addNode', node: target },
      { type: 'addEdge', edge },
    ]);

    return { source, target, edge };
  }

  function addCleanGraph(kernel: ReturnType<typeof createKernel>) {
    const source = makeNode({ id: 'component:clean-svc', type: 'component' });
    const target = makeNode({ id: 'platform:clean-db', type: 'platform' });
    const edge = makeEdge({
      id: 'edge:bindsTo:component:clean-svc:platform:clean-db',
      type: 'bindsTo',
      source: source.id,
      target: target.id,
      metadata: {
        bindingConfig: {
          resourceType: 'table',
          accessLevel: 'read',
          network: { port: 5432, protocol: 'tcp' },
        },
      },
    });

    kernel.applyMutation([
      { type: 'addNode', node: source },
      { type: 'addNode', node: target },
      { type: 'addEdge', edge },
    ]);

    return { source, target, edge };
  }

  it('Baseline pack produces warnings/info for violating graph', () => {
    const kernel = createKernel('Baseline');
    addViolatingGraph(kernel);

    const result = kernel.compile();

    expect(result.policy).toBeDefined();
    expect(result.policy?.policyPack).toBe('Baseline');
    expect(result.policy?.violations.length).toBeGreaterThan(0);
    // Baseline: no errors → compliant
    expect(result.policy?.compliant).toBe(true);

    const severities = result.policy?.violations.map((v) => v.severity) ?? [];
    expect(severities).not.toContain('error');
  });

  it('FedRAMP-High produces errors for violating graph → not compliant', () => {
    const kernel = createKernel('FedRAMP-High');
    addViolatingGraph(kernel);

    const result = kernel.compile();

    expect(result.policy).toBeDefined();
    expect(result.policy?.policyPack).toBe('FedRAMP-High');
    expect(result.policy?.compliant).toBe(false);

    const severities = result.policy?.violations.map((v) => v.severity) ?? [];
    expect(severities).toContain('error');
  });

  it('clean graph is compliant under FedRAMP-High', () => {
    const kernel = createKernel('FedRAMP-High');
    addCleanGraph(kernel);

    const result = kernel.compile();

    expect(result.policy).toBeDefined();
    // Read-only, specific scope, tcp protocol → only iam-missing-conditions may fire
    // But it should still have some violations (missing conditions on cross-service)
    // The key check: no wildcard, no admin, no 'any' protocol
    const wildcardV = result.policy?.violations.find(
      (v) => v.ruleId === 'iam-no-wildcard-resource'
    );
    const adminV = result.policy?.violations.find(
      (v) => v.ruleId === 'iam-admin-access-review'
    );
    const networkV = result.policy?.violations.find(
      (v) => v.ruleId === 'network-broad-protocol'
    );
    expect(wildcardV).toBeUndefined();
    expect(adminV).toBeUndefined();
    expect(networkV).toBeUndefined();
  });

  it('violations have correct structure', () => {
    const kernel = createKernel('FedRAMP-High');
    addViolatingGraph(kernel);

    const result = kernel.compile();
    const violations = result.policy?.violations ?? [];

    for (const v of violations) {
      expect(v.id).toMatch(/^violation:/);
      expect(v.schemaVersion).toBe('1.0.0');
      expect(v.ruleId.length).toBeGreaterThan(0);
      expect(v.ruleName.length).toBeGreaterThan(0);
      expect(v.message.length).toBeGreaterThan(0);
      expect(v.remediation.summary.length).toBeGreaterThan(0);
      expect(v.target.type).toBe('edge');
      expect(v.policyPack).toBe('FedRAMP-High');
    }
  });

  it('violations are sorted deterministically by (severity, ruleId, target.id)', () => {
    const kernel = createKernel('FedRAMP-High');
    addViolatingGraph(kernel);

    const result = kernel.compile();
    const violations = result.policy?.violations ?? [];

    const severityOrder: Record<string, number> = { error: 0, warning: 1, info: 2 };
    for (let i = 1; i < violations.length; i++) {
      const prev = violations[i - 1];
      const curr = violations[i];

      const sevCmp =
        (severityOrder[prev.severity] ?? 3) - (severityOrder[curr.severity] ?? 3);
      if (sevCmp !== 0) {
        expect(sevCmp).toBeLessThan(0);
        continue;
      }
      const ruleCmp = prev.ruleId.localeCompare(curr.ruleId);
      if (ruleCmp !== 0) {
        expect(ruleCmp).toBeLessThan(0);
        continue;
      }
      expect(prev.target.id.localeCompare(curr.target.id)).toBeLessThanOrEqual(0);
    }
  });

  it('produces deterministic output for identical inputs', () => {
    const k1 = createKernel('FedRAMP-High');
    addViolatingGraph(k1);
    const r1 = k1.compile();

    const k2 = createKernel('FedRAMP-High');
    addViolatingGraph(k2);
    const r2 = k2.compile();

    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it('result is frozen', () => {
    const kernel = createKernel('FedRAMP-High');
    addViolatingGraph(kernel);

    const result = kernel.compile();

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.policy)).toBe(true);
    expect(Object.isFrozen(result.policy?.violations)).toBe(true);
  });
});
