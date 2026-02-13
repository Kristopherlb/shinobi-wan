import { describe, it, expect, beforeEach } from 'vitest';
import { Graph } from '../graph';
import { ConflictError, IntegrityError } from '../errors';
import type { Node, Edge, DerivedArtifact, GraphSnapshot } from '../types';

// Test fixtures
function createNode(overrides: Partial<Node> = {}): Node {
  return {
    id: 'component:test',
    semanticHash: 'sha256:abc123',
    type: 'component',
    provenance: { sourceFile: 'test.ts' },
    metadata: { properties: {} },
    schemaVersion: '1.0.0',
    ...overrides,
  };
}

function createEdge(overrides: Partial<Edge> = {}): Edge {
  return {
    id: 'edge:bindsTo:component:a:component:b',
    semanticHash: 'sha256:def456',
    type: 'bindsTo',
    source: 'component:a',
    target: 'component:b',
    provenance: { sourceFile: 'test.ts' },
    metadata: { bindingConfig: {} },
    schemaVersion: '1.0.0',
    ...overrides,
  };
}

function createArtifact(overrides: Partial<DerivedArtifact> = {}): DerivedArtifact {
  return {
    id: 'artifact:iam-policy:component:test',
    semanticHash: 'sha256:ghi789',
    type: 'iam-policy',
    sourceNodeId: 'component:test',
    content: {},
    provenance: { derivedFrom: ['component:test'] },
    schemaVersion: '1.0.0',
    ...overrides,
  };
}

describe('Graph', () => {
  let graph: Graph;

  beforeEach(() => {
    graph = new Graph();
  });

  describe('addNode', () => {
    it('adds a new node to the graph', () => {
      const node = createNode();
      graph.addNode(node);

      expect(graph.getNode(node.id)).toEqual(node);
    });

    it('is idempotent - same node added twice is a no-op', () => {
      const node = createNode();
      graph.addNode(node);
      graph.addNode(node); // Same id, same semanticHash

      expect(graph.getNode(node.id)).toEqual(node);
    });

    it('throws ConflictError when same ID has different semanticHash', () => {
      const node1 = createNode({ semanticHash: 'sha256:hash1' });
      const node2 = createNode({ semanticHash: 'sha256:hash2' });

      graph.addNode(node1);

      expect(() => graph.addNode(node2)).toThrow(ConflictError);
    });
  });

  describe('addEdge', () => {
    it('adds an edge when both source and target nodes exist', () => {
      const source = createNode({ id: 'component:a' });
      const target = createNode({ id: 'component:b' });
      const edge = createEdge();

      graph.addNode(source);
      graph.addNode(target);
      graph.addEdge(edge);

      expect(graph.getEdge(edge.id)).toEqual(edge);
    });

    it('throws IntegrityError when source node does not exist', () => {
      const target = createNode({ id: 'component:b' });
      const edge = createEdge();

      graph.addNode(target);

      expect(() => graph.addEdge(edge)).toThrow(IntegrityError);
    });

    it('throws IntegrityError when target node does not exist', () => {
      const source = createNode({ id: 'component:a' });
      const edge = createEdge();

      graph.addNode(source);

      expect(() => graph.addEdge(edge)).toThrow(IntegrityError);
    });

    it('is idempotent - same edge added twice is a no-op', () => {
      const source = createNode({ id: 'component:a' });
      const target = createNode({ id: 'component:b' });
      const edge = createEdge();

      graph.addNode(source);
      graph.addNode(target);
      graph.addEdge(edge);
      graph.addEdge(edge); // Same id, same semanticHash

      expect(graph.getEdge(edge.id)).toEqual(edge);
    });

    it('throws ConflictError when same ID has different semanticHash', () => {
      const source = createNode({ id: 'component:a' });
      const target = createNode({ id: 'component:b' });
      const edge1 = createEdge({ semanticHash: 'sha256:hash1' });
      const edge2 = createEdge({ semanticHash: 'sha256:hash2' });

      graph.addNode(source);
      graph.addNode(target);
      graph.addEdge(edge1);

      expect(() => graph.addEdge(edge2)).toThrow(ConflictError);
    });
  });

  describe('addArtifact', () => {
    it('adds an artifact to the graph', () => {
      const artifact = createArtifact();
      graph.addArtifact(artifact);

      expect(graph.getArtifact(artifact.id)).toEqual(artifact);
    });

    it('is idempotent - same artifact added twice is a no-op', () => {
      const artifact = createArtifact();
      graph.addArtifact(artifact);
      graph.addArtifact(artifact);

      expect(graph.getArtifact(artifact.id)).toEqual(artifact);
    });

    it('throws ConflictError when same ID has different semanticHash', () => {
      const artifact1 = createArtifact({ semanticHash: 'sha256:hash1' });
      const artifact2 = createArtifact({ semanticHash: 'sha256:hash2' });

      graph.addArtifact(artifact1);

      expect(() => graph.addArtifact(artifact2)).toThrow(ConflictError);
    });
  });

  describe('applyMutation', () => {
    it('applies multiple mutations atomically', () => {
      const node1 = createNode({ id: 'component:a' });
      const node2 = createNode({ id: 'component:b' });

      const result = graph.applyMutation([
        { type: 'addNode', node: node1 },
        { type: 'addNode', node: node2 },
      ]);

      expect(result.success).toBe(true);
      expect(result.appliedCount).toBe(2);
      expect(graph.getNode('component:a')).toEqual(node1);
      expect(graph.getNode('component:b')).toEqual(node2);
    });

    it('rolls back all mutations on any error (copy-on-write)', () => {
      const node1 = createNode({ id: 'component:a' });
      const edge = createEdge(); // References non-existent nodes

      const result = graph.applyMutation([
        { type: 'addNode', node: node1 },
        { type: 'addEdge', edge: edge }, // Will fail
      ]);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBe(1);
      // node1 should NOT be in graph due to rollback
      expect(graph.getNode('component:a')).toBeUndefined();
    });

    it('reports skipped mutations for idempotent operations', () => {
      const node = createNode({ id: 'component:a' });
      graph.addNode(node);

      const result = graph.applyMutation([
        { type: 'addNode', node: node }, // Already exists, same hash
      ]);

      expect(result.success).toBe(true);
      expect(result.skippedCount).toBe(1);
      expect(result.appliedCount).toBe(0);
    });

    it('handles mixed node and edge mutations', () => {
      const nodeA = createNode({ id: 'component:a' });
      const nodeB = createNode({ id: 'component:b' });
      const edge = createEdge();

      const result = graph.applyMutation([
        { type: 'addNode', node: nodeA },
        { type: 'addNode', node: nodeB },
        { type: 'addEdge', edge: edge },
      ]);

      expect(result.success).toBe(true);
      expect(result.appliedCount).toBe(3);
      expect(graph.getEdge(edge.id)).toEqual(edge);
    });
  });

  describe('toSnapshot', () => {
    it('returns an empty snapshot for empty graph', () => {
      const snapshot = graph.toSnapshot();

      expect(snapshot.schemaVersion).toBe('1.0.0');
      expect(snapshot.nodes).toEqual([]);
      expect(snapshot.edges).toEqual([]);
      expect(snapshot.artifacts).toEqual([]);
    });

    it('returns nodes in canonical order', () => {
      const nodeZ = createNode({ id: 'component:z', type: 'component' });
      const nodeA = createNode({ id: 'component:a', type: 'component' });
      const capNode = createNode({ id: 'capability:x', type: 'capability' });

      graph.addNode(nodeZ);
      graph.addNode(nodeA);
      graph.addNode(capNode);

      const snapshot = graph.toSnapshot();

      // capability comes before component alphabetically
      expect(snapshot.nodes[0].id).toBe('capability:x');
      expect(snapshot.nodes[1].id).toBe('component:a');
      expect(snapshot.nodes[2].id).toBe('component:z');
    });

    it('returns edges in canonical order', () => {
      const nodeA = createNode({ id: 'component:a' });
      const nodeB = createNode({ id: 'component:b' });
      const nodeC = createNode({ id: 'component:c' });

      graph.addNode(nodeA);
      graph.addNode(nodeB);
      graph.addNode(nodeC);

      const edge1 = createEdge({
        id: 'edge:dependsOn:component:a:component:b',
        type: 'dependsOn',
        source: 'component:a',
        target: 'component:b',
      });
      const edge2 = createEdge({
        id: 'edge:bindsTo:component:a:component:c',
        type: 'bindsTo',
        source: 'component:a',
        target: 'component:c',
      });

      graph.addEdge(edge1);
      graph.addEdge(edge2);

      const snapshot = graph.toSnapshot();

      // bindsTo comes before dependsOn
      expect(snapshot.edges[0].type).toBe('bindsTo');
      expect(snapshot.edges[1].type).toBe('dependsOn');
    });

    it('returns readonly arrays', () => {
      const node = createNode();
      graph.addNode(node);

      const snapshot = graph.toSnapshot();

      // TypeScript enforces ReadonlyArray at compile time
      expect(Array.isArray(snapshot.nodes)).toBe(true);
    });
  });

  describe('query methods', () => {
    it('hasNode returns true for existing nodes', () => {
      const node = createNode();
      graph.addNode(node);

      expect(graph.hasNode(node.id)).toBe(true);
    });

    it('hasNode returns false for non-existent nodes', () => {
      expect(graph.hasNode('component:nonexistent')).toBe(false);
    });

    it('getAllNodes returns all nodes', () => {
      const node1 = createNode({ id: 'component:a' });
      const node2 = createNode({ id: 'component:b' });

      graph.addNode(node1);
      graph.addNode(node2);

      expect(graph.getAllNodes()).toHaveLength(2);
    });

    it('getAllEdges returns all edges', () => {
      const nodeA = createNode({ id: 'component:a' });
      const nodeB = createNode({ id: 'component:b' });
      const edge = createEdge();

      graph.addNode(nodeA);
      graph.addNode(nodeB);
      graph.addEdge(edge);

      expect(graph.getAllEdges()).toHaveLength(1);
    });
  });

  describe('determinism', () => {
    it('produces identical snapshots regardless of insertion order', () => {
      const graph1 = new Graph();
      const graph2 = new Graph();

      const nodeA = createNode({ id: 'component:a' });
      const nodeB = createNode({ id: 'component:b' });
      const nodeC = createNode({ id: 'capability:c', type: 'capability' });

      // Different insertion orders
      graph1.addNode(nodeA);
      graph1.addNode(nodeB);
      graph1.addNode(nodeC);

      graph2.addNode(nodeC);
      graph2.addNode(nodeA);
      graph2.addNode(nodeB);

      const snapshot1 = graph1.toSnapshot();
      const snapshot2 = graph2.toSnapshot();

      expect(snapshot1.nodes.map((n) => n.id)).toEqual(
        snapshot2.nodes.map((n) => n.id)
      );
    });
  });
});
