import { describe, it, expect } from 'vitest';
import type { GraphMutation } from '@shinobi/ir';
import { createTestNode, createTestEdge } from '@shinobi/ir';
import { Kernel } from '@shinobi/kernel';
import { runGoldenCase } from '../golden-runner';
import type { GoldenCase } from '../types';

/*──────────────────────────────────────────────────────────────────────────────
 * G-001 (SCHEMA)   – Graph IR validates against schema
 * G-002 (DETERMINISM) – Graph serialization is deterministic
 * G-003 (GOLDEN)   – Invalid graph structure rejected
 *────────────────────────────────────────────────────────────────────────────*/

function validGraphSetup(): ReadonlyArray<GraphMutation> {
  const component = createTestNode({ id: 'component:web-app', type: 'component' });
  const platform = createTestNode({ id: 'platform:aws-rds', type: 'platform' });
  const edge = createTestEdge({
    id: 'edge:bindsTo:component:web-app:platform:aws-rds',
    type: 'bindsTo',
    source: component.id,
    target: platform.id,
    metadata: {
      bindingConfig: {
        resourceType: 'database',
        accessLevel: 'read',
        network: { port: 5432, protocol: 'tcp' },
      },
    },
  });

  return [
    { type: 'addNode', node: component },
    { type: 'addNode', node: platform },
    { type: 'addEdge', edge },
  ];
}

describe('Golden: Graph IR (G-001, G-002, G-003)', () => {
  const CASE_SCHEMA: GoldenCase = {
    id: 'golden:graph:valid-schema',
    description: 'Valid graph compiles with correct schema structure',
    gates: ['G-001'],
  };

  const CASE_DETERMINISM: GoldenCase = {
    id: 'golden:graph:determinism',
    description: 'Identical graph inputs produce identical byte-stable output',
    gates: ['G-002'],
  };

  const CASE_INVALID: GoldenCase = {
    id: 'golden:graph:invalid-dangling-edge',
    description: 'Graph with dangling edge reference is rejected at mutation time',
    gates: ['G-003'],
  };

  describe(`${CASE_SCHEMA.id} — ${CASE_SCHEMA.description}`, () => {
    it('G-001: valid graph produces valid compilation result', () => {
      const { compilation } = runGoldenCase({ setup: validGraphSetup });

      expect(compilation.validation.valid).toBe(true);
      expect(compilation.snapshot.schemaVersion).toBe('1.0.0');
      expect(Array.isArray(compilation.snapshot.nodes)).toBe(true);
      expect(Array.isArray(compilation.snapshot.edges)).toBe(true);
      expect(Array.isArray(compilation.snapshot.artifacts)).toBe(true);
    });

    it('G-001: all nodes have schemaVersion 1.0.0', () => {
      const { compilation } = runGoldenCase({ setup: validGraphSetup });

      for (const node of compilation.snapshot.nodes) {
        expect(node.schemaVersion).toBe('1.0.0');
        expect(node.id.length).toBeGreaterThan(0);
        expect(node.semanticHash.length).toBeGreaterThan(0);
      }
    });

    it('G-001: all edges have schemaVersion 1.0.0 and valid references', () => {
      const { compilation } = runGoldenCase({ setup: validGraphSetup });
      const nodeIds = new Set(compilation.snapshot.nodes.map((n) => n.id));

      for (const edge of compilation.snapshot.edges) {
        expect(edge.schemaVersion).toBe('1.0.0');
        expect(nodeIds.has(edge.source)).toBe(true);
        expect(nodeIds.has(edge.target)).toBe(true);
      }
    });
  });

  describe(`${CASE_DETERMINISM.id} — ${CASE_DETERMINISM.description}`, () => {
    it('G-002: two identical compilations produce byte-identical JSON', () => {
      const r1 = runGoldenCase({ setup: validGraphSetup });
      const r2 = runGoldenCase({ setup: validGraphSetup });

      expect(r1.serialized).toBe(r2.serialized);
      expect(r1.serialized).toMatchSnapshot();
    });
  });

  describe(`${CASE_INVALID.id} — ${CASE_INVALID.description}`, () => {
    it('G-003: dangling edge reference rejected by mutation batch', () => {
      const kernel = new Kernel();

      const component = createTestNode({ id: 'component:orphan', type: 'component' });
      const edge = createTestEdge({
        id: 'edge:bindsTo:component:orphan:platform:missing',
        type: 'bindsTo',
        source: component.id,
        target: 'platform:missing',
      });

      // Batch with dangling edge should fail atomically
      const result = kernel.applyMutation([
        { type: 'addNode', node: component },
        { type: 'addEdge', edge },
      ]);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      // Atomic rollback: the node was also not applied
      expect(kernel.hasNode('component:orphan')).toBe(false);
    });

    it('G-003: rejected mutation produces deterministic error', () => {
      const component = createTestNode({ id: 'component:orphan', type: 'component' });
      const edge = createTestEdge({
        id: 'edge:bindsTo:component:orphan:platform:missing',
        type: 'bindsTo',
        source: component.id,
        target: 'platform:missing',
      });

      const k1 = new Kernel();
      const r1 = k1.applyMutation([
        { type: 'addNode', node: component },
        { type: 'addEdge', edge },
      ]);

      const k2 = new Kernel();
      const r2 = k2.applyMutation([
        { type: 'addNode', node: component },
        { type: 'addEdge', edge },
      ]);

      expect(r1.success).toBe(r2.success);
      expect(r1.errors.length).toBe(r2.errors.length);
      expect(r1.errors[0]?.error.message).toBe(r2.errors[0]?.error.message);
    });
  });
});
