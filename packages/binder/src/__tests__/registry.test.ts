import { describe, it, expect } from 'vitest';
import type { IBinder } from '@shinobi/kernel';
import { BinderRegistry } from '../registry';

function makeBinder(
  id: string,
  patterns: IBinder['supportedEdgeTypes']
): IBinder {
  return {
    id,
    supportedEdgeTypes: patterns,
    compileEdge: () => ({ intents: [], diagnostics: [] }),
  };
}

describe('BinderRegistry', () => {
  it('registers and retrieves a binder', () => {
    const registry = new BinderRegistry();
    const binder = makeBinder('b1', [
      { edgeType: 'bindsTo', sourceType: 'component', targetType: 'platform' },
    ]);

    registry.register(binder);
    expect(registry.getBinders()).toHaveLength(1);
    expect(registry.getBinders()[0].id).toBe('b1');
  });

  it('finds a binder by edge pattern', () => {
    const registry = new BinderRegistry();
    const binder = makeBinder('b1', [
      { edgeType: 'bindsTo', sourceType: 'component', targetType: 'platform' },
    ]);

    registry.register(binder);
    const found = registry.findBinder('bindsTo', 'component', 'platform');
    expect(found).toBeDefined();
    expect(found?.id).toBe('b1');
  });

  it('returns undefined for unregistered pattern', () => {
    const registry = new BinderRegistry();
    const binder = makeBinder('b1', [
      { edgeType: 'bindsTo', sourceType: 'component', targetType: 'platform' },
    ]);

    registry.register(binder);
    const found = registry.findBinder('triggers', 'component', 'platform');
    expect(found).toBeUndefined();
  });

  it('throws on duplicate edge pattern', () => {
    const registry = new BinderRegistry();
    const b1 = makeBinder('b1', [
      { edgeType: 'bindsTo', sourceType: 'component', targetType: 'platform' },
    ]);
    const b2 = makeBinder('b2', [
      { edgeType: 'bindsTo', sourceType: 'component', targetType: 'platform' },
    ]);

    registry.register(b1);
    expect(() => registry.register(b2)).toThrow(
      /Duplicate edge pattern.*b2.*b1.*bindsTo:component:platform/
    );
  });

  it('allows multiple binders for different patterns', () => {
    const registry = new BinderRegistry();
    const b1 = makeBinder('b1', [
      { edgeType: 'bindsTo', sourceType: 'component', targetType: 'platform' },
    ]);
    const b2 = makeBinder('b2', [
      { edgeType: 'triggers', sourceType: 'component', targetType: 'component' },
    ]);

    registry.register(b1);
    registry.register(b2);
    expect(registry.getBinders()).toHaveLength(2);
    expect(registry.findBinder('bindsTo', 'component', 'platform')?.id).toBe('b1');
    expect(registry.findBinder('triggers', 'component', 'component')?.id).toBe('b2');
  });

  it('supports binders with multiple patterns', () => {
    const registry = new BinderRegistry();
    const binder = makeBinder('multi', [
      { edgeType: 'bindsTo', sourceType: 'component', targetType: 'platform' },
      { edgeType: 'bindsTo', sourceType: 'component', targetType: 'config' },
    ]);

    registry.register(binder);
    expect(registry.findBinder('bindsTo', 'component', 'platform')?.id).toBe('multi');
    expect(registry.findBinder('bindsTo', 'component', 'config')?.id).toBe('multi');
  });

  it('returns empty array when no binders registered', () => {
    const registry = new BinderRegistry();
    expect(registry.getBinders()).toHaveLength(0);
    expect(registry.findBinder('bindsTo', 'component', 'platform')).toBeUndefined();
  });
});
