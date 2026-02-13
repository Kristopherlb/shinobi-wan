import { describe, it, expect } from 'vitest';
import {
  compareNodes,
  compareEdges,
  compareArtifacts,
} from '../ordering';
import type { Node, Edge, DerivedArtifact } from '../types';

// Test fixtures
function createNode(overrides: Partial<Node>): Node {
  return {
    id: 'component:test',
    semanticHash: 'sha256:test',
    type: 'component',
    provenance: { sourceFile: 'test.ts' },
    metadata: { properties: {} },
    schemaVersion: '1.0.0',
    ...overrides,
  };
}

function createEdge(overrides: Partial<Edge>): Edge {
  return {
    id: 'edge:bindsTo:a:b',
    semanticHash: 'sha256:test',
    type: 'bindsTo',
    source: 'component:a',
    target: 'capability:b',
    provenance: { sourceFile: 'test.ts' },
    metadata: { bindingConfig: {} },
    schemaVersion: '1.0.0',
    ...overrides,
  };
}

function createArtifact(overrides: Partial<DerivedArtifact>): DerivedArtifact {
  return {
    id: 'artifact:iam-policy:test',
    semanticHash: 'sha256:test',
    type: 'iam-policy',
    sourceNodeId: 'component:test',
    content: {},
    provenance: { derivedFrom: [] },
    schemaVersion: '1.0.0',
    ...overrides,
  };
}

describe('compareNodes', () => {
  it('sorts primarily by type', () => {
    const capability = createNode({ id: 'capability:z', type: 'capability' });
    const component = createNode({ id: 'component:a', type: 'component' });

    const sorted = [component, capability].sort(compareNodes);

    expect(sorted[0].type).toBe('capability');
    expect(sorted[1].type).toBe('component');
  });

  it('sorts by id within same type', () => {
    const nodeA = createNode({ id: 'component:a' });
    const nodeB = createNode({ id: 'component:b' });
    const nodeC = createNode({ id: 'component:c' });

    const sorted = [nodeC, nodeA, nodeB].sort(compareNodes);

    expect(sorted.map((n) => n.id)).toEqual([
      'component:a',
      'component:b',
      'component:c',
    ]);
  });

  it('provides total ordering - no two distinct nodes compare equal', () => {
    const nodes = [
      createNode({ id: 'component:a', type: 'component' }),
      createNode({ id: 'component:b', type: 'component' }),
      createNode({ id: 'capability:a', type: 'capability' }),
      createNode({ id: 'capability:b', type: 'capability' }),
    ];

    // Check all pairs are non-equal
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        expect(compareNodes(nodes[i], nodes[j])).not.toBe(0);
      }
    }
  });

  it('is transitive', () => {
    const a = createNode({ id: 'capability:a', type: 'capability' });
    const b = createNode({ id: 'capability:b', type: 'capability' });
    const c = createNode({ id: 'component:a', type: 'component' });

    // a < b and b < c implies a < c
    expect(compareNodes(a, b)).toBeLessThan(0);
    expect(compareNodes(b, c)).toBeLessThan(0);
    expect(compareNodes(a, c)).toBeLessThan(0);
  });

  it('is stable across multiple sorts', () => {
    const nodes = [
      createNode({ id: 'component:z', type: 'component' }),
      createNode({ id: 'capability:a', type: 'capability' }),
      createNode({ id: 'component:a', type: 'component' }),
    ];

    const sorted1 = [...nodes].sort(compareNodes);
    const sorted2 = [...nodes].sort(compareNodes);

    expect(sorted1.map((n) => n.id)).toEqual(sorted2.map((n) => n.id));
  });
});

describe('compareEdges', () => {
  it('sorts primarily by type', () => {
    const bindsTo = createEdge({
      id: 'edge:bindsTo:z:z',
      type: 'bindsTo',
    });
    const dependsOn = createEdge({
      id: 'edge:dependsOn:a:a',
      type: 'dependsOn',
    });

    const sorted = [dependsOn, bindsTo].sort(compareEdges);

    expect(sorted[0].type).toBe('bindsTo');
    expect(sorted[1].type).toBe('dependsOn');
  });

  it('sorts by source within same type', () => {
    const edgeA = createEdge({ id: 'edge:bindsTo:a:z', source: 'a' });
    const edgeB = createEdge({ id: 'edge:bindsTo:b:z', source: 'b' });

    const sorted = [edgeB, edgeA].sort(compareEdges);

    expect(sorted[0].source).toBe('a');
    expect(sorted[1].source).toBe('b');
  });

  it('sorts by target within same type and source', () => {
    const edgeA = createEdge({
      id: 'edge:bindsTo:x:a',
      source: 'x',
      target: 'a',
    });
    const edgeB = createEdge({
      id: 'edge:bindsTo:x:b',
      source: 'x',
      target: 'b',
    });

    const sorted = [edgeB, edgeA].sort(compareEdges);

    expect(sorted[0].target).toBe('a');
    expect(sorted[1].target).toBe('b');
  });

  it('uses id as final tie-breaker', () => {
    const edge1 = createEdge({
      id: 'edge:bindsTo:x:y:1',
      type: 'bindsTo',
      source: 'x',
      target: 'y',
    });
    const edge2 = createEdge({
      id: 'edge:bindsTo:x:y:2',
      type: 'bindsTo',
      source: 'x',
      target: 'y',
    });

    const sorted = [edge2, edge1].sort(compareEdges);

    expect(sorted[0].id).toBe('edge:bindsTo:x:y:1');
    expect(sorted[1].id).toBe('edge:bindsTo:x:y:2');
  });

  it('provides total ordering - no two distinct edges compare equal', () => {
    const edges = [
      createEdge({ id: 'edge:bindsTo:a:b', type: 'bindsTo', source: 'a', target: 'b' }),
      createEdge({ id: 'edge:bindsTo:a:c', type: 'bindsTo', source: 'a', target: 'c' }),
      createEdge({ id: 'edge:dependsOn:a:b', type: 'dependsOn', source: 'a', target: 'b' }),
    ];

    for (let i = 0; i < edges.length; i++) {
      for (let j = i + 1; j < edges.length; j++) {
        expect(compareEdges(edges[i], edges[j])).not.toBe(0);
      }
    }
  });
});

describe('compareArtifacts', () => {
  it('sorts primarily by type', () => {
    const iam = createArtifact({
      id: 'artifact:iam-policy:z',
      type: 'iam-policy',
    });
    const network = createArtifact({
      id: 'artifact:network-rule:a',
      type: 'network-rule',
    });

    const sorted = [network, iam].sort(compareArtifacts);

    expect(sorted[0].type).toBe('iam-policy');
    expect(sorted[1].type).toBe('network-rule');
  });

  it('sorts by id within same type', () => {
    const artifactA = createArtifact({ id: 'artifact:iam-policy:a' });
    const artifactB = createArtifact({ id: 'artifact:iam-policy:b' });

    const sorted = [artifactB, artifactA].sort(compareArtifacts);

    expect(sorted[0].id).toBe('artifact:iam-policy:a');
    expect(sorted[1].id).toBe('artifact:iam-policy:b');
  });

  it('provides total ordering - no two distinct artifacts compare equal', () => {
    const artifacts = [
      createArtifact({ id: 'artifact:iam-policy:a', type: 'iam-policy' }),
      createArtifact({ id: 'artifact:iam-policy:b', type: 'iam-policy' }),
      createArtifact({ id: 'artifact:network-rule:a', type: 'network-rule' }),
    ];

    for (let i = 0; i < artifacts.length; i++) {
      for (let j = i + 1; j < artifacts.length; j++) {
        expect(compareArtifacts(artifacts[i], artifacts[j])).not.toBe(0);
      }
    }
  });
});
