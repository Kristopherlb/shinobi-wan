import { describe, it, expect } from 'vitest';
import { Kernel } from '../kernel';
import { explainCompilation } from '../explain';
import type { IBinder } from '../interfaces/binder-interface';
import { createTestNode, createTestEdge } from '@shinobi/ir';

function buildCompilation(binders: IBinder[] = []) {
  const kernel = new Kernel({ binders, evaluators: [] });
  kernel.applyMutation([
    {
      type: 'addNode',
      node: createTestNode({ id: 'component:api', type: 'component' }),
    },
    {
      type: 'addNode',
      node: createTestNode({ id: 'platform:queue', type: 'platform' }),
    },
    {
      type: 'addEdge',
      edge: createTestEdge({
        id: 'edge:bindsTo:component:api:platform:queue',
        type: 'bindsTo',
        source: 'component:api',
        target: 'platform:queue',
      }),
    },
  ]);
  return kernel.compile();
}

describe('explainCompilation', () => {
  it('explains unbound edges with a remediation', () => {
    const report = explainCompilation(buildCompilation());
    const entry = report.entries.find((e) => e.kind === 'binding-diagnostic');
    expect(entry).toBeDefined();
    expect(entry?.because).toContain('No binder registered');
    expect(entry?.remediation).toContain('Register a binder');
  });

  it('traces intents back to their source edge and node pair', () => {
    const binder: IBinder = {
      name: 'test-binder',
      supportedEdgeTypes: [
        {
          edgeType: 'bindsTo',
          sourceType: 'component',
          targetType: 'platform',
        },
      ],
      compileEdge: ({ edge }) => ({
        intents: [
          {
            type: 'config',
            schemaVersion: '1.0.0',
            sourceEdgeId: edge.id,
            key: 'QUEUE_URL',
            targetNodeRef: 'component:api',
            valueSource: { type: 'literal', value: 'x' },
          } as never,
        ],
        diagnostics: [],
      }),
    };
    const report = explainCompilation(buildCompilation([binder]));
    const entry = report.entries.find((e) => e.kind === 'intent');
    expect(entry).toBeDefined();
    expect(entry?.because).toContain('"bindsTo" relationship');
    expect(entry?.origin.sourceNodeId).toBe('component:api');
    expect(entry?.origin.targetNodeId).toBe('platform:queue');
  });

  it('is deterministic and sorted', () => {
    const a = explainCompilation(buildCompilation());
    const b = explainCompilation(buildCompilation());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const subjects = a.entries.map((e) => `${e.kind}:${e.subject}`);
    expect([...subjects].sort()).toEqual(subjects);
  });
});
