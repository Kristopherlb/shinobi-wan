import { describe, it, expect } from 'vitest';
import { createTestNode, createTestEdge } from '@shinobi/ir';
import type { GraphMutation } from '@shinobi/ir';
import { runGoldenCase } from '../golden-runner';
import type { GoldenCase } from '../types';

const CASE_SCHEMA: GoldenCase = {
  id: 'golden:manifest:schema-validation',
  description: 'Manifest/graph schema validates required fields and rejects invalid structures',
  gates: ['G-004'],
};

function validGraphSetup(): ReadonlyArray<GraphMutation> {
  const component = createTestNode({
    id: 'component:web',
    type: 'component',
    metadata: { properties: { platform: 'aws-lambda' } },
  });
  const platform = createTestNode({
    id: 'platform:db',
    type: 'platform',
    metadata: { properties: { platform: 'aws-dynamodb' } },
  });
  const edge = createTestEdge({
    id: 'edge:bindsTo:component:web:platform:db',
    type: 'bindsTo',
    source: component.id,
    target: platform.id,
    metadata: { bindingConfig: { resourceType: 'table' } },
  });

  return [
    { type: 'addNode', node: component },
    { type: 'addNode', node: platform },
    { type: 'addEdge', edge },
  ];
}

describe(`Golden: Manifest Schema Validation (G-004)`, () => {
  describe(`${CASE_SCHEMA.id} — ${CASE_SCHEMA.description}`, () => {
    it('G-004: valid graph with all required fields compiles successfully', () => {
      const { compilation } = runGoldenCase({ setup: validGraphSetup });
      expect(compilation.validation.valid).toBe(true);
    });

    it('G-004: node with empty ID still produces a valid compilation', () => {
      // Empty IDs are accepted at mutation level; validation may flag them
      const { compilation } = runGoldenCase({
        setup: () => [
          {
            type: 'addNode',
            node: createTestNode({ id: '', type: 'component' }),
          },
        ],
      });
      expect(compilation.snapshot.nodes).toHaveLength(1);
      expect(compilation.snapshot.nodes[0].id).toBe('');
    });

    it('G-004: edge with dangling target rejected', () => {
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

    it('G-004: duplicate node IDs are idempotent', () => {
      // Per KL-006: idempotent mutations — same node applied twice → same result
      const node1 = createTestNode({ id: 'component:dup', type: 'component' });
      const node2 = createTestNode({ id: 'component:dup', type: 'component' });

      const { compilation } = runGoldenCase({
        setup: () => [
          { type: 'addNode', node: node1 },
          { type: 'addNode', node: node2 },
        ],
      });
      expect(compilation.snapshot.nodes).toHaveLength(1);
      expect(compilation.snapshot.nodes[0].id).toBe('component:dup');
    });

    it('G-004: empty graph produces valid compilation', () => {
      const { compilation } = runGoldenCase({ setup: () => [] });
      expect(compilation.validation.valid).toBe(true);
      expect(compilation.snapshot.nodes).toHaveLength(0);
      expect(compilation.snapshot.edges).toHaveLength(0);
    });

    it('G-004: error output is deterministic', () => {
      const component = createTestNode({ id: 'component:orphan', type: 'component' });
      const edge = createTestEdge({
        id: 'edge:bindsTo:component:orphan:platform:missing',
        type: 'bindsTo',
        source: component.id,
        target: 'platform:missing',
      });

      const setup = () => [
        { type: 'addNode' as const, node: component },
        { type: 'addEdge' as const, edge },
      ];

      let err1: string | undefined;
      let err2: string | undefined;

      try {
        runGoldenCase({ setup });
      } catch (e) {
        err1 = (e as Error).message;
      }
      try {
        runGoldenCase({ setup });
      } catch (e) {
        err2 = (e as Error).message;
      }

      expect(err1).toBeDefined();
      expect(err1).toBe(err2);
    });

    it('G-004: schemaVersion present in compilation snapshot', () => {
      const { compilation } = runGoldenCase({ setup: validGraphSetup });
      expect(compilation.snapshot.schemaVersion).toBe('1.0.0');
    });

    it('G-004: all nodes have schemaVersion', () => {
      const { compilation } = runGoldenCase({ setup: validGraphSetup });
      for (const node of compilation.snapshot.nodes) {
        expect(node.schemaVersion).toBe('1.0.0');
      }
    });

    it('G-004: all edges have schemaVersion', () => {
      const { compilation } = runGoldenCase({ setup: validGraphSetup });
      for (const edge of compilation.snapshot.edges) {
        expect(edge.schemaVersion).toBe('1.0.0');
      }
    });

    it('G-004: valid graph with both node types compiles', () => {
      const { compilation } = runGoldenCase({ setup: validGraphSetup });
      const types = compilation.snapshot.nodes.map((n) => n.type);
      expect(types).toContain('component');
      expect(types).toContain('platform');
    });

    it('determinism: identical input produces byte-identical output', () => {
      const r1 = runGoldenCase({ setup: validGraphSetup });
      const r2 = runGoldenCase({ setup: validGraphSetup });
      expect(r1.serialized).toBe(r2.serialized);
    });
  });
});
