import { describe, it, expect } from 'vitest';
import { serializeGraph, deserializeGraph } from '../serialization';
import { Graph } from '../graph';
import { ValidationError } from '../errors';
import type { Node, Edge, DerivedArtifact } from '../types';

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
    content: { statements: [] },
    provenance: { derivedFrom: ['component:test'] },
    schemaVersion: '1.0.0',
    ...overrides,
  };
}

describe('serializeGraph', () => {
  it('produces valid JSON', () => {
    const graph = new Graph();
    const json = serializeGraph(graph);

    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('includes schemaVersion in output', () => {
    const graph = new Graph();
    const json = serializeGraph(graph);
    const parsed = JSON.parse(json);

    expect(parsed.schemaVersion).toBe('1.0.0');
  });

  it('serializes nodes in canonical order', () => {
    const graph = new Graph();
    const nodeZ = createNode({ id: 'component:z' });
    const nodeA = createNode({ id: 'component:a' });

    graph.addNode(nodeZ);
    graph.addNode(nodeA);

    const json = serializeGraph(graph);
    const parsed = JSON.parse(json);

    expect(parsed.nodes[0].id).toBe('component:a');
    expect(parsed.nodes[1].id).toBe('component:z');
  });

  it('is deterministic - same graph produces identical output', () => {
    const graph = new Graph();
    graph.addNode(createNode({ id: 'component:a' }));
    graph.addNode(createNode({ id: 'component:b' }));

    const json1 = serializeGraph(graph);
    const json2 = serializeGraph(graph);

    expect(json1).toBe(json2);
  });

  it('is key-order independent', () => {
    const graph1 = new Graph();
    const graph2 = new Graph();

    // Add nodes with properties in different key orders
    const node1: Node = {
      id: 'component:test',
      semanticHash: 'sha256:abc',
      type: 'component',
      provenance: { sourceFile: 'a.ts' },
      metadata: { properties: { z: 1, a: 2 } },
      schemaVersion: '1.0.0',
    };

    const node2: Node = {
      schemaVersion: '1.0.0',
      metadata: { properties: { a: 2, z: 1 } },
      provenance: { sourceFile: 'a.ts' },
      type: 'component',
      semanticHash: 'sha256:abc',
      id: 'component:test',
    };

    graph1.addNode(node1);
    graph2.addNode(node2);

    const json1 = serializeGraph(graph1);
    const json2 = serializeGraph(graph2);

    expect(json1).toBe(json2);
  });
});

describe('deserializeGraph', () => {
  it('creates a graph from valid JSON', () => {
    const json = JSON.stringify({
      schemaVersion: '1.0.0',
      nodes: [createNode()],
      edges: [],
      artifacts: [],
    });

    const graph = deserializeGraph(json);

    expect(graph.getNode('component:test')).toBeDefined();
  });

  it('validates the snapshot before constructing', () => {
    const invalidJson = JSON.stringify({
      schemaVersion: '2.0.0', // Invalid version
      nodes: [],
      edges: [],
      artifacts: [],
    });

    expect(() => deserializeGraph(invalidJson)).toThrow(ValidationError);
  });

  it('validates nodes in the snapshot', () => {
    const jsonWithInvalidNode = JSON.stringify({
      schemaVersion: '1.0.0',
      nodes: [{ id: 'invalid' }], // Missing required fields
      edges: [],
      artifacts: [],
    });

    expect(() => deserializeGraph(jsonWithInvalidNode)).toThrow(ValidationError);
  });

  it('restores edges with integrity checks', () => {
    const nodeA = createNode({ id: 'component:a' });
    const nodeB = createNode({ id: 'component:b' });
    const edge = createEdge();

    const json = JSON.stringify({
      schemaVersion: '1.0.0',
      nodes: [nodeA, nodeB],
      edges: [edge],
      artifacts: [],
    });

    const graph = deserializeGraph(json);

    expect(graph.getEdge(edge.id)).toBeDefined();
  });

  it('throws on invalid JSON', () => {
    expect(() => deserializeGraph('not valid json')).toThrow();
  });
});

describe('round-trip serialization', () => {
  it('preserves all graph data through round-trip', () => {
    const original = new Graph();
    const nodeA = createNode({ id: 'component:a' });
    const nodeB = createNode({ id: 'component:b' });
    const edge = createEdge();
    const artifact = createArtifact();

    original.addNode(nodeA);
    original.addNode(nodeB);
    original.addEdge(edge);
    original.addArtifact(artifact);

    const json = serializeGraph(original);
    const restored = deserializeGraph(json);

    expect(restored.getNode('component:a')).toEqual(nodeA);
    expect(restored.getNode('component:b')).toEqual(nodeB);
    expect(restored.getEdge(edge.id)).toEqual(edge);
    expect(restored.getArtifact(artifact.id)).toEqual(artifact);
  });

  it('produces identical JSON after round-trip', () => {
    const graph = new Graph();
    graph.addNode(createNode({ id: 'component:a' }));
    graph.addNode(createNode({ id: 'component:b' }));

    const json1 = serializeGraph(graph);
    const restored = deserializeGraph(json1);
    const json2 = serializeGraph(restored);

    expect(json1).toBe(json2);
  });
});

describe('determinism (golden test behavior)', () => {
  it('produces identical output when run twice', () => {
    const graph = new Graph();
    graph.addNode(createNode({ id: 'component:api', metadata: { properties: { port: 8080 } } }));
    graph.addNode(createNode({ id: 'capability:queue', type: 'capability' }));

    const run1 = serializeGraph(graph);
    const run2 = serializeGraph(graph);

    expect(run1).toBe(run2);
  });

  it('produces identical output regardless of insertion order', () => {
    const nodeA = createNode({ id: 'component:a' });
    const nodeB = createNode({ id: 'component:b' });
    const nodeC = createNode({ id: 'capability:c', type: 'capability' });

    const graph1 = new Graph();
    graph1.addNode(nodeA);
    graph1.addNode(nodeB);
    graph1.addNode(nodeC);

    const graph2 = new Graph();
    graph2.addNode(nodeC);
    graph2.addNode(nodeB);
    graph2.addNode(nodeA);

    expect(serializeGraph(graph1)).toBe(serializeGraph(graph2));
  });

  it('contains no UUIDs or timestamps in output', () => {
    const graph = new Graph();
    graph.addNode(createNode());

    const json = serializeGraph(graph);

    // UUID pattern
    expect(json).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    // ISO timestamp pattern
    expect(json).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
