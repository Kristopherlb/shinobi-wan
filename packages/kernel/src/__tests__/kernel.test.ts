import { describe, it, expect } from 'vitest';
import { Kernel } from '../kernel';
import type { KernelOptions } from '../kernel';
import { createTestNode, createTestEdge } from '@shinobi/ir';
import type { IBinder } from '../interfaces/binder-interface';
import type { IPolicyEvaluator } from '../interfaces/policy-evaluator-interface';

describe('Kernel', () => {
  it('constructs with defaults', () => {
    const kernel = new Kernel();
    expect(kernel).toBeDefined();
  });

  it('constructs with options', () => {
    const options: KernelOptions = {
      config: { policyPack: 'Baseline' },
      binders: [],
      evaluators: [],
    };
    const kernel = new Kernel(options);
    expect(kernel).toBeDefined();
  });

  it('applies mutations and queries nodes', () => {
    const kernel = new Kernel();
    const node = createTestNode({ id: 'component:my-svc', type: 'component' });

    const result = kernel.applyMutation([{ type: 'addNode', node }]);
    expect(result.success).toBe(true);
    expect(result.appliedCount).toBe(1);
    expect(kernel.hasNode('component:my-svc')).toBe(true);
    expect(kernel.getNode('component:my-svc')).toEqual(node);
  });

  it('preserves idempotency on duplicate mutations', () => {
    const kernel = new Kernel();
    const node = createTestNode({ id: 'component:svc', type: 'component' });

    kernel.applyMutation([{ type: 'addNode', node }]);
    const result = kernel.applyMutation([{ type: 'addNode', node }]);
    expect(result.success).toBe(true);
    expect(result.skippedCount).toBe(1);
    expect(result.appliedCount).toBe(0);
  });

  it('adds edges with referential integrity', () => {
    const kernel = new Kernel();
    const n1 = createTestNode({ id: 'component:a', type: 'component' });
    const n2 = createTestNode({ id: 'platform:b', type: 'platform' });
    const e1 = createTestEdge({
      id: 'edge:bindsTo:component:a:platform:b',
      type: 'bindsTo',
      source: n1.id,
      target: n2.id,
    });

    kernel.applyMutation([{ type: 'addNode', node: n1 }, { type: 'addNode', node: n2 }]);
    const result = kernel.applyMutation([{ type: 'addEdge', edge: e1 }]);
    expect(result.success).toBe(true);
    expect(kernel.hasEdge(e1.id)).toBe(true);
    expect(kernel.getEdge(e1.id)).toEqual(e1);
  });

  it('snapshot returns a frozen GraphSnapshot', () => {
    const kernel = new Kernel();
    const node = createTestNode({ id: 'component:svc', type: 'component' });
    kernel.applyMutation([{ type: 'addNode', node }]);

    const snap = kernel.snapshot();
    expect(Object.isFrozen(snap)).toBe(true);
    expect(snap.nodes).toHaveLength(1);
    expect(snap.nodes[0].id).toBe('component:svc');
  });

  it('validate returns a valid ValidationResult for a valid graph', () => {
    const kernel = new Kernel();
    const node = createTestNode({ id: 'component:svc', type: 'component' });
    kernel.applyMutation([{ type: 'addNode', node }]);

    const result = kernel.validate();
    expect(result).toHaveProperty('valid');
    expect(result).toHaveProperty('errors');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('compile works with no binders or evaluators', () => {
    const kernel = new Kernel();
    const node = createTestNode({ id: 'component:svc', type: 'component' });
    kernel.applyMutation([{ type: 'addNode', node }]);

    const result = kernel.compile();
    expect(result.validation.valid).toBe(true);
    expect(result.intents).toEqual([]);
    expect(result.policy).toBeUndefined();
  });

  it('compile invokes binders for matching edges', () => {
    const binder: IBinder = {
      id: 'test-binder',
      supportedEdgeTypes: [{ edgeType: 'bindsTo', sourceType: 'component', targetType: 'platform' }],
      compileEdge: (ctx) => ({
        intents: [{
          type: 'iam' as const,
          schemaVersion: '1.0.0' as const,
          sourceEdgeId: ctx.edge.id,
        }],
        diagnostics: [],
      }),
    };

    const kernel = new Kernel({ binders: [binder] });
    const n1 = createTestNode({ id: 'component:svc', type: 'component' });
    const n2 = createTestNode({ id: 'platform:lambda', type: 'platform' });
    const e1 = createTestEdge({
      id: 'edge:bindsTo:component:svc:platform:lambda',
      type: 'bindsTo',
      source: n1.id,
      target: n2.id,
    });

    kernel.applyMutation([
      { type: 'addNode', node: n1 },
      { type: 'addNode', node: n2 },
    ]);
    kernel.applyMutation([{ type: 'addEdge', edge: e1 }]);

    const result = kernel.compile();
    expect(result.intents).toHaveLength(1);
    expect(result.intents[0].sourceEdgeId).toBe(e1.id);
  });

  it('compile evaluates policy when policyPack is set', () => {
    const evaluator: IPolicyEvaluator = {
      id: 'test-eval',
      supportedPacks: ['Baseline'],
      evaluate: () => [],
    };

    const kernel = new Kernel({
      config: { policyPack: 'Baseline' },
      evaluators: [evaluator],
    });

    const result = kernel.compile();
    const { policy } = result;
    expect(policy).toBeDefined();
    expect(policy?.compliant).toBe(true);
    expect(policy?.policyPack).toBe('Baseline');
  });

  it('compile sets compliant to false when evaluator returns violations', () => {
    const binder: IBinder = {
      id: 'test-binder',
      supportedEdgeTypes: [{ edgeType: 'bindsTo', sourceType: 'component', targetType: 'platform' }],
      compileEdge: (ctx) => ({
        intents: [{
          type: 'iam' as const,
          schemaVersion: '1.0.0' as const,
          sourceEdgeId: ctx.edge.id,
        }],
        diagnostics: [],
      }),
    };

    const evaluator: IPolicyEvaluator = {
      id: 'violation-eval',
      supportedPacks: ['Baseline'],
      evaluate: () => [{
        id: 'violation:test-rule:component:svc',
        schemaVersion: '1.0.0' as const,
        ruleId: 'test-rule',
        ruleName: 'Test Rule',
        severity: 'error' as const,
        message: 'Test violation',
        target: { type: 'node' as const, id: 'component:svc' },
        policyPack: 'Baseline',
        remediation: { summary: 'Fix it', autoFixable: false },
      }],
    };

    const kernel = new Kernel({
      binders: [binder],
      evaluators: [evaluator],
      config: { policyPack: 'Baseline' },
    });

    const n1 = createTestNode({ id: 'component:svc', type: 'component' });
    const n2 = createTestNode({ id: 'platform:lambda', type: 'platform' });
    const e1 = createTestEdge({
      id: 'edge:bindsTo:component:svc:platform:lambda',
      type: 'bindsTo',
      source: n1.id,
      target: n2.id,
    });

    kernel.applyMutation([
      { type: 'addNode', node: n1 },
      { type: 'addNode', node: n2 },
    ]);
    kernel.applyMutation([{ type: 'addEdge', edge: e1 }]);

    const result = kernel.compile();
    expect(result.policy?.compliant).toBe(false);
    expect(result.policy?.violations).toHaveLength(1);
    expect(result.policy?.violations[0].ruleId).toBe('test-rule');
  });

  it('getResolvedConfig returns frozen merged config', () => {
    const kernel = new Kernel({
      config: {
        layers: [
          { source: 'defaults', values: { region: 'us-east-1' } },
          { source: 'overrides', values: { debug: true } },
        ],
      },
    });

    const resolved = kernel.getResolvedConfig();
    expect(resolved).toEqual({ region: 'us-east-1', debug: true });
    expect(Object.isFrozen(resolved)).toBe(true);
  });

  it('hasNode/hasEdge/hasArtifact return false for missing IDs', () => {
    const kernel = new Kernel();
    expect(kernel.hasNode('nonexistent')).toBe(false);
    expect(kernel.hasEdge('nonexistent')).toBe(false);
    expect(kernel.hasArtifact('nonexistent')).toBe(false);
  });

  it('getNode/getEdge/getArtifact return undefined for missing IDs', () => {
    const kernel = new Kernel();
    expect(kernel.getNode('nonexistent')).toBeUndefined();
    expect(kernel.getEdge('nonexistent')).toBeUndefined();
    expect(kernel.getArtifact('nonexistent')).toBeUndefined();
  });

  it('produces deterministic output — two identical kernels yield identical compile results', () => {
    const buildKernel = () => {
      const k = new Kernel();
      const n1 = createTestNode({ id: 'component:svc', type: 'component' });
      const n2 = createTestNode({ id: 'platform:lambda', type: 'platform' });
      k.applyMutation([
        { type: 'addNode', node: n1 },
        { type: 'addNode', node: n2 },
      ]);
      return k;
    };

    const r1 = buildKernel().compile();
    const r2 = buildKernel().compile();
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});
