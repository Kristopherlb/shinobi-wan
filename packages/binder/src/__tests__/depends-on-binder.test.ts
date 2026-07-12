import { describe, it, expect } from 'vitest';
import { DependsOnBinder } from '../binders/depends-on-binder';
import { BinderRegistry } from '../registry';
import { ComponentPlatformBinder } from '../binders/component-platform-binder';
import { TriggersBinder } from '../binders/triggers-binder';
import { createTestNode, createTestEdge } from '@shinobi/ir';

const binder = new DependsOnBinder();

function makeContext(
  sourceType: 'component' | 'platform',
  targetType: 'component' | 'platform',
) {
  const sourceNode = createTestNode({
    id: `${sourceType}:a`,
    type: sourceType,
  });
  const targetNode = createTestNode({
    id: `${targetType}:b`,
    type: targetType,
  });
  const edge = createTestEdge({
    id: `edge:dependsOn:${sourceType}:a:${targetType}:b`,
    type: 'dependsOn',
    source: sourceNode.id,
    target: targetNode.id,
  });
  return { edge, sourceNode, targetNode, config: {} };
}

describe('DependsOnBinder', () => {
  it('supports dependsOn across all node type pairs', () => {
    const pairs = binder.supportedEdgeTypes;
    expect(pairs).toHaveLength(4);
    expect(pairs.every((p) => p.edgeType === 'dependsOn')).toBe(true);
  });

  it('emits no intents — ordering is structural, not privileged', () => {
    const output = binder.compileEdge(makeContext('component', 'platform'));
    expect(output.intents).toHaveLength(0);
  });

  it('emits an explainable info diagnostic instead of silence', () => {
    const output = binder.compileEdge(makeContext('component', 'component'));
    expect(output.diagnostics).toHaveLength(1);
    expect(output.diagnostics[0].rule).toBe('depends-on-ordering');
    expect(output.diagnostics[0].severity).toBe('info');
    expect(output.diagnostics[0].message).toContain('ordering only');
  });

  it('registers alongside the default binders without conflict', () => {
    const registry = new BinderRegistry();
    registry.register(new ComponentPlatformBinder());
    registry.register(new TriggersBinder());
    expect(() => registry.register(new DependsOnBinder())).not.toThrow();
    expect(registry.getBinders()).toHaveLength(3);
  });

  it('is deterministic', () => {
    const ctx = makeContext('platform', 'platform');
    expect(JSON.stringify(binder.compileEdge(ctx))).toBe(
      JSON.stringify(binder.compileEdge(ctx)),
    );
  });
});
