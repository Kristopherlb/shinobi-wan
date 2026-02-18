import { describe, it, expect } from 'vitest';
import { createTestNode, createTestEdge } from '@shinobi/ir';
import { runGoldenCase } from '../golden-runner';

describe('runGoldenCase', () => {
  it('throws when setup mutation batch fails', () => {
    const component = createTestNode({ id: 'component:orphan', type: 'component' });
    const edge = createTestEdge({
      id: 'edge:bindsTo:component:orphan:platform:missing',
      type: 'bindsTo',
      source: component.id,
      target: 'platform:missing',
    });

    expect(() =>
      runGoldenCase({
        setup: () => [
          { type: 'addNode', node: component },
          { type: 'addEdge', edge },
        ],
      }),
    ).toThrow('Golden setup failed:');
  });

  it('returns compilation and serialized output when setup succeeds', () => {
    const component = createTestNode({ id: 'component:web', type: 'component' });
    const platform = createTestNode({ id: 'platform:db', type: 'platform' });
    const edge = createTestEdge({
      id: 'edge:bindsTo:component:web:platform:db',
      type: 'bindsTo',
      source: component.id,
      target: platform.id,
      metadata: { bindingConfig: { resourceType: 'table' } },
    });

    const result = runGoldenCase({
      setup: () => [
        { type: 'addNode', node: component },
        { type: 'addNode', node: platform },
        { type: 'addEdge', edge },
      ],
    });

    expect(result.compilation.validation.valid).toBe(true);
    expect(typeof result.serialized).toBe('string');
  });
});
