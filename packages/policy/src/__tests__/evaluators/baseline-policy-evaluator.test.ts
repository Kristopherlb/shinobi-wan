import { describe, it, expect } from 'vitest';
import type { PolicyEvaluationContext } from '@shinobi/kernel';
import type { ConfigIntent, TelemetryIntent, Intent } from '@shinobi/contracts';
import { BaselinePolicyEvaluator } from '../../evaluators/baseline-policy-evaluator';
import { makeSnapshot, makeNode, makeIamIntent, makeNetworkIntent } from '../test-helpers';

describe('BaselinePolicyEvaluator', () => {
  const evaluator = new BaselinePolicyEvaluator();

  function makeContext(
    intents: ReadonlyArray<Intent>,
    policyPack = 'Baseline'
  ): PolicyEvaluationContext {
    const nodes = [
      makeNode({ id: 'component:svc', type: 'component' }),
      makeNode({ id: 'platform:db', type: 'platform' }),
    ];
    return {
      snapshot: makeSnapshot(nodes, []),
      intents,
      policyPack,
      config: {},
    };
  }

  describe('metadata', () => {
    it('has correct id', () => {
      expect(evaluator.id).toBe('baseline-policy-evaluator');
    });

    it('supports all three packs', () => {
      expect(evaluator.supportedPacks).toContain('Baseline');
      expect(evaluator.supportedPacks).toContain('FedRAMP-Moderate');
      expect(evaluator.supportedPacks).toContain('FedRAMP-High');
    });
  });

  describe('iam-no-wildcard-resource', () => {
    it('flags IAM intent with pattern scope', () => {
      const intent = makeIamIntent({
        sourceEdgeId: 'edge:bindsTo:component:svc:platform:db',
        resource: {
          nodeRef: 'platform:db',
          resourceType: 'table',
          scope: 'pattern',
          pattern: 'uploads/*',
        },
      });

      const violations = evaluator.evaluate(makeContext([intent]));
      const v = violations.find((v) => v.ruleId === 'iam-no-wildcard-resource');
      expect(v).toBeDefined();
      expect(v?.severity).toBe('warning'); // Baseline → warning
      expect(v?.message).toContain('pattern-scoped');
    });

    it('does not flag IAM intent with specific scope', () => {
      const intent = makeIamIntent({
        sourceEdgeId: 'edge:bindsTo:component:svc:platform:db',
      });

      const violations = evaluator.evaluate(makeContext([intent]));
      const v = violations.find((v) => v.ruleId === 'iam-no-wildcard-resource');
      expect(v).toBeUndefined();
    });

    it('severity escalates to error for FedRAMP-High', () => {
      const intent = makeIamIntent({
        sourceEdgeId: 'edge:bindsTo:component:svc:platform:db',
        resource: {
          nodeRef: 'platform:db',
          resourceType: 'table',
          scope: 'pattern',
          pattern: '*',
        },
      });

      const violations = evaluator.evaluate(makeContext([intent], 'FedRAMP-High'));
      const v = violations.find((v) => v.ruleId === 'iam-no-wildcard-resource');
      expect(v?.severity).toBe('error');
    });
  });

  describe('iam-admin-access-review', () => {
    it('flags IAM intent with admin-level actions', () => {
      const intent = makeIamIntent({
        sourceEdgeId: 'edge:bindsTo:component:svc:platform:db',
        actions: [
          { level: 'read', action: 'read' },
          { level: 'admin', action: 'admin' },
        ],
      });

      const violations = evaluator.evaluate(makeContext([intent]));
      const v = violations.find((v) => v.ruleId === 'iam-admin-access-review');
      expect(v).toBeDefined();
      expect(v?.severity).toBe('info'); // Baseline → info
    });

    it('does not flag read-only actions', () => {
      const intent = makeIamIntent({
        sourceEdgeId: 'edge:bindsTo:component:svc:platform:db',
        actions: [{ level: 'read', action: 'read' }],
      });

      const violations = evaluator.evaluate(makeContext([intent]));
      const v = violations.find((v) => v.ruleId === 'iam-admin-access-review');
      expect(v).toBeUndefined();
    });

    it('severity is error for FedRAMP-High', () => {
      const intent = makeIamIntent({
        sourceEdgeId: 'edge:bindsTo:component:svc:platform:db',
        actions: [{ level: 'admin', action: 'admin' }],
      });

      const violations = evaluator.evaluate(makeContext([intent], 'FedRAMP-High'));
      const v = violations.find((v) => v.ruleId === 'iam-admin-access-review');
      expect(v?.severity).toBe('error');
    });
  });

  describe('iam-missing-conditions', () => {
    it('flags cross-service IAM without conditions', () => {
      const intent = makeIamIntent({
        sourceEdgeId: 'edge:bindsTo:component:svc:platform:db',
        principal: { nodeRef: 'component:svc', role: 'service' },
        resource: { nodeRef: 'platform:db', resourceType: 'table', scope: 'specific' },
      });

      const violations = evaluator.evaluate(makeContext([intent]));
      const v = violations.find((v) => v.ruleId === 'iam-missing-conditions');
      expect(v).toBeDefined();
      expect(v?.severity).toBe('info'); // Baseline → info
    });

    it('does not flag same-node IAM without conditions', () => {
      const intent = makeIamIntent({
        sourceEdgeId: 'edge:bindsTo:component:svc:component:svc',
        principal: { nodeRef: 'component:svc', role: 'service' },
        resource: { nodeRef: 'component:svc', resourceType: 'table', scope: 'specific' },
      });

      const violations = evaluator.evaluate(makeContext([intent]));
      const v = violations.find((v) => v.ruleId === 'iam-missing-conditions');
      expect(v).toBeUndefined();
    });

    it('does not flag cross-service IAM with conditions', () => {
      const intent = makeIamIntent({
        sourceEdgeId: 'edge:bindsTo:component:svc:platform:db',
        principal: { nodeRef: 'component:svc', role: 'service' },
        resource: { nodeRef: 'platform:db', resourceType: 'table', scope: 'specific' },
        conditions: [{ key: 'env', operator: 'equals', value: 'prod' }],
      });

      const violations = evaluator.evaluate(makeContext([intent]));
      const v = violations.find((v) => v.ruleId === 'iam-missing-conditions');
      expect(v).toBeUndefined();
    });

    it('severity is error for FedRAMP-High', () => {
      const intent = makeIamIntent({
        sourceEdgeId: 'edge:bindsTo:component:svc:platform:db',
      });

      const violations = evaluator.evaluate(makeContext([intent], 'FedRAMP-High'));
      const v = violations.find((v) => v.ruleId === 'iam-missing-conditions');
      expect(v?.severity).toBe('error');
    });
  });

  describe('network-broad-protocol', () => {
    it('flags network intent with protocol "any"', () => {
      const intent = makeNetworkIntent({
        sourceEdgeId: 'edge:bindsTo:component:svc:platform:db',
        protocol: { protocol: 'any' },
      });

      const violations = evaluator.evaluate(makeContext([intent]));
      const v = violations.find((v) => v.ruleId === 'network-broad-protocol');
      expect(v).toBeDefined();
      expect(v?.severity).toBe('info'); // Baseline → info
    });

    it('does not flag tcp protocol', () => {
      const intent = makeNetworkIntent({
        sourceEdgeId: 'edge:bindsTo:component:svc:platform:db',
        protocol: { protocol: 'tcp' },
      });

      const violations = evaluator.evaluate(makeContext([intent]));
      const v = violations.find((v) => v.ruleId === 'network-broad-protocol');
      expect(v).toBeUndefined();
    });

    it('severity is error for FedRAMP-High', () => {
      const intent = makeNetworkIntent({
        sourceEdgeId: 'edge:bindsTo:component:svc:platform:db',
        protocol: { protocol: 'any' },
      });

      const violations = evaluator.evaluate(makeContext([intent], 'FedRAMP-High'));
      const v = violations.find((v) => v.ruleId === 'network-broad-protocol');
      expect(v?.severity).toBe('error');
    });
  });

  describe('clean intents', () => {
    it('produces no violations for a compliant IAM intent', () => {
      const intent = makeIamIntent({
        sourceEdgeId: 'edge:bindsTo:component:svc:platform:db',
        resource: { nodeRef: 'platform:db', resourceType: 'table', scope: 'specific' },
        actions: [{ level: 'read', action: 'read' }],
        conditions: [{ key: 'env', operator: 'equals', value: 'prod' }],
      });

      const violations = evaluator.evaluate(makeContext([intent]));
      expect(violations).toHaveLength(0);
    });

    it('ignores config intents (no rules apply)', () => {
      const configIntent: ConfigIntent = {
        type: 'config',
        schemaVersion: '1.0.0',
        sourceEdgeId: 'edge:bindsTo:component:svc:platform:db',
        targetNodeRef: 'component:svc',
        key: 'DB_URL',
        valueSource: { type: 'reference', nodeRef: 'platform:db', field: 'url' },
      };

      const violations = evaluator.evaluate(makeContext([configIntent]));
      expect(violations).toHaveLength(0);
    });

    it('ignores telemetry intents (no rules apply)', () => {
      const telemetryIntent: TelemetryIntent = {
        type: 'telemetry',
        schemaVersion: '1.0.0',
        sourceEdgeId: 'edge:bindsTo:component:svc:platform:db',
        targetNodeRef: 'component:svc',
        telemetryType: 'metrics',
        config: { enabled: true, samplingRate: 1.0 },
      };

      const violations = evaluator.evaluate(makeContext([telemetryIntent]));
      expect(violations).toHaveLength(0);
    });
  });

  describe('severity tiers across packs', () => {
    it('same intent produces different severities per pack', () => {
      const intent = makeIamIntent({
        sourceEdgeId: 'edge:bindsTo:component:svc:platform:db',
        resource: {
          nodeRef: 'platform:db',
          resourceType: 'table',
          scope: 'pattern',
          pattern: '*',
        },
        actions: [{ level: 'admin', action: 'admin' }],
      });

      const baselineViolations = evaluator.evaluate(makeContext([intent], 'Baseline'));
      const moderateViolations = evaluator.evaluate(makeContext([intent], 'FedRAMP-Moderate'));
      const highViolations = evaluator.evaluate(makeContext([intent], 'FedRAMP-High'));

      // iam-no-wildcard-resource
      const bWild = baselineViolations.find((v) => v.ruleId === 'iam-no-wildcard-resource');
      const mWild = moderateViolations.find((v) => v.ruleId === 'iam-no-wildcard-resource');
      const hWild = highViolations.find((v) => v.ruleId === 'iam-no-wildcard-resource');
      expect(bWild?.severity).toBe('warning');
      expect(mWild?.severity).toBe('error');
      expect(hWild?.severity).toBe('error');

      // iam-admin-access-review
      const bAdmin = baselineViolations.find((v) => v.ruleId === 'iam-admin-access-review');
      const mAdmin = moderateViolations.find((v) => v.ruleId === 'iam-admin-access-review');
      const hAdmin = highViolations.find((v) => v.ruleId === 'iam-admin-access-review');
      expect(bAdmin?.severity).toBe('info');
      expect(mAdmin?.severity).toBe('warning');
      expect(hAdmin?.severity).toBe('error');
    });
  });

  describe('determinism', () => {
    it('identical inputs produce identical output', () => {
      const intent = makeIamIntent({
        sourceEdgeId: 'edge:bindsTo:component:svc:platform:db',
        resource: {
          nodeRef: 'platform:db',
          resourceType: 'table',
          scope: 'pattern',
          pattern: '*',
        },
        actions: [{ level: 'admin', action: 'admin' }],
      });

      const ctx = makeContext([intent], 'FedRAMP-High');
      const r1 = evaluator.evaluate(ctx);
      const r2 = evaluator.evaluate(ctx);

      expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
    });
  });
});
