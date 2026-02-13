import { describe, it, expect } from 'vitest';
import { compilePipeline } from '../compilation-pipeline';
import { PolicyPackError } from '../errors';
import type { GraphSnapshot } from '@shinobi/ir';
import { createTestNode, createTestEdge, createSnapshot } from '@shinobi/ir';
import type { Intent } from '@shinobi/contracts';
import type { IBinder } from '../interfaces/binder-interface';
import type { IPolicyEvaluator } from '../interfaces/policy-evaluator-interface';
import type { KernelConfig } from '../types';

function makeIntent(type: Intent['type'], sourceEdgeId: string): Intent {
  return {
    type,
    schemaVersion: '1.0.0',
    sourceEdgeId,
  };
}

function makeMockBinder(
  id: string,
  edgeType: Edge['type'],
  sourceType: Node['type'],
  targetType: Node['type'],
  intentFactory: (edgeId: string) => Intent[] = (edgeId) => [makeIntent('iam', edgeId)]
): IBinder {
  return {
    id,
    supportedEdgeTypes: [{ edgeType, sourceType, targetType }],
    compileEdge: (ctx) => ({
      intents: intentFactory(ctx.edge.id),
      diagnostics: [],
    }),
  };
}

const emptyConfig: KernelConfig = {};

// --- Tests ---

describe('compilePipeline', () => {
  it('returns early with validation errors for invalid snapshot', () => {
    const invalidSnapshot = { schemaVersion: '1.0.0', nodes: [], edges: [], artifacts: [] } as GraphSnapshot;
    // An empty but valid snapshot should pass validation
    const result = compilePipeline(invalidSnapshot, emptyConfig, [], []);
    expect(result.validation.valid).toBe(true);
  });

  it('compiles an empty graph with no binders or evaluators', () => {
    const snapshot = createSnapshot([], []);
    const result = compilePipeline(snapshot, emptyConfig, [], []);

    expect(result.validation.valid).toBe(true);
    expect(result.intents).toEqual([]);
    expect(result.bindingDiagnostics).toEqual([]);
    expect(result.policy).toBeUndefined();
    expect(result.resolvedConfig).toEqual({});
  });

  it('produces unbound-edge diagnostic when no binder matches', () => {
    const n1 = createTestNode({ id: 'component:svc-a', type: 'component' });
    const n2 = createTestNode({ id: 'platform:aws-lambda', type: 'platform' });
    const e1 = createTestEdge({
      id: 'edge:bindsTo:component:svc-a:platform:aws-lambda',
      type: 'bindsTo',
      source: n1.id,
      target: n2.id,
    });
    const snapshot = createSnapshot([n1, n2], [e1]);

    const result = compilePipeline(snapshot, emptyConfig, [], []);
    expect(result.bindingDiagnostics.some((d) => d.rule === 'unbound-edge')).toBe(true);
    expect(result.intents).toEqual([]);
  });

  it('invokes matching binder and collects intents', () => {
    const n1 = createTestNode({ id: 'component:svc-a', type: 'component' });
    const n2 = createTestNode({ id: 'platform:aws-lambda', type: 'platform' });
    const e1 = createTestEdge({
      id: 'edge:bindsTo:component:svc-a:platform:aws-lambda',
      type: 'bindsTo',
      source: n1.id,
      target: n2.id,
    });
    const snapshot = createSnapshot([n1, n2], [e1]);
    const binder = makeMockBinder('test-binder', 'bindsTo', 'component', 'platform');

    const result = compilePipeline(snapshot, emptyConfig, [binder], []);
    expect(result.intents).toHaveLength(1);
    expect(result.intents[0].type).toBe('iam');
    expect(result.intents[0].sourceEdgeId).toBe(e1.id);
  });

  it('sorts intents deterministically by (type, sourceEdgeId)', () => {
    const n1 = createTestNode({ id: 'component:a', type: 'component' });
    const n2 = createTestNode({ id: 'platform:b', type: 'platform' });
    const n3 = createTestNode({ id: 'platform:c', type: 'platform' });
    const e1 = createTestEdge({
      id: 'edge:bindsTo:component:a:platform:c',
      type: 'bindsTo',
      source: n1.id,
      target: n3.id,
    });
    const e2 = createTestEdge({
      id: 'edge:bindsTo:component:a:platform:b',
      type: 'bindsTo',
      source: n1.id,
      target: n2.id,
    });
    const snapshot = createSnapshot([n1, n2, n3], [e1, e2]);

    const binder: IBinder = {
      id: 'multi-binder',
      supportedEdgeTypes: [{ edgeType: 'bindsTo', sourceType: 'component', targetType: 'platform' }],
      compileEdge: (ctx) => ({
        intents: [
          makeIntent('network', ctx.edge.id),
          makeIntent('iam', ctx.edge.id),
        ],
        diagnostics: [],
      }),
    };

    const result = compilePipeline(snapshot, emptyConfig, [binder], []);
    // Should be sorted by type first (iam before network), then by sourceEdgeId
    expect(result.intents[0].type).toBe('iam');
    expect(result.intents[result.intents.length - 1].type).toBe('network');
  });

  it('skips policy evaluation when no policyPack is set', () => {
    const snapshot = createSnapshot([], []);
    const result = compilePipeline(snapshot, emptyConfig, [], []);
    expect(result.policy).toBeUndefined();
  });

  it('throws PolicyPackError when requested pack has no evaluator', () => {
    const snapshot = createSnapshot([], []);
    const config: KernelConfig = { policyPack: 'FedRAMP-High' };

    expect(() => compilePipeline(snapshot, config, [], [])).toThrow(PolicyPackError);
  });

  it('evaluates policy when pack and evaluator match', () => {
    const snapshot = createSnapshot([], []);
    const config: KernelConfig = { policyPack: 'Baseline' };

    const evaluator: IPolicyEvaluator = {
      id: 'test-evaluator',
      supportedPacks: ['Baseline'],
      evaluate: () => [],
    };

    const result = compilePipeline(snapshot, config, [], [evaluator]);
    const { policy } = result;
    expect(policy).toBeDefined();
    expect(policy?.compliant).toBe(true);
    expect(policy?.policyPack).toBe('Baseline');
    expect(policy?.violations).toEqual([]);
  });

  it('returns frozen result', () => {
    const snapshot = createSnapshot([], []);
    const result = compilePipeline(snapshot, emptyConfig, [], []);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.intents)).toBe(true);
    expect(Object.isFrozen(result.resolvedConfig)).toBe(true);
  });

  it('produces deterministic output for identical inputs', () => {
    const n1 = createTestNode({ id: 'component:svc', type: 'component' });
    const n2 = createTestNode({ id: 'platform:lambda', type: 'platform' });
    const e1 = createTestEdge({
      id: 'edge:bindsTo:component:svc:platform:lambda',
      type: 'bindsTo',
      source: n1.id,
      target: n2.id,
    });
    const snapshot = createSnapshot([n1, n2], [e1]);
    const binder = makeMockBinder('b1', 'bindsTo', 'component', 'platform');

    const r1 = compilePipeline(snapshot, emptyConfig, [binder], []);
    const r2 = compilePipeline(snapshot, emptyConfig, [binder], []);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});
