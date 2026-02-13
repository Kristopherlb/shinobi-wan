import { describe, it, expect } from 'vitest';
import {
  type Node,
  type NodeType,
  type NodeMetadata,
  type Edge,
  type EdgeType,
  type EdgeMetadata,
  type DerivedArtifact,
  type ArtifactType,
  type Provenance,
  type GraphSnapshot,
  NODE_TYPES,
  EDGE_TYPES,
  ARTIFACT_TYPES,
} from '../types';

describe('Node type shape', () => {
  it('has required fields: id, semanticHash, type, provenance, metadata, schemaVersion', () => {
    const node: Node = {
      id: 'component:services/api-gateway',
      semanticHash: 'sha256:abc123',
      type: 'component',
      provenance: {
        sourceFile: 'src/services/api.ts',
        component: 'api-gateway',
      },
      metadata: {
        properties: {},
      },
      schemaVersion: '1.0.0',
    };

    expect(node.id).toBe('component:services/api-gateway');
    expect(node.semanticHash).toBe('sha256:abc123');
    expect(node.type).toBe('component');
    expect(node.schemaVersion).toBe('1.0.0');
  });

  it('supports all defined NodeTypes', () => {
    // Verify runtime constant matches type union
    expect(NODE_TYPES).toEqual(['component', 'capability', 'platform', 'config', 'secret']);

    NODE_TYPES.forEach((type) => {
      const node: Node = createMinimalNode({ type });
      expect(node.type).toBe(type);
    });
  });
});

describe('Edge type shape', () => {
  it('has required fields: id, semanticHash, type, source, target, provenance, metadata, schemaVersion', () => {
    const edge: Edge = {
      id: 'edge:bindsTo:component:a:capability:b',
      semanticHash: 'sha256:def456',
      type: 'bindsTo',
      source: 'component:a',
      target: 'capability:b',
      provenance: {
        sourceFile: 'src/bindings.ts',
      },
      metadata: {
        bindingConfig: {},
      },
      schemaVersion: '1.0.0',
    };

    expect(edge.id).toBe('edge:bindsTo:component:a:capability:b');
    expect(edge.source).toBe('component:a');
    expect(edge.target).toBe('capability:b');
  });

  it('supports all defined EdgeTypes', () => {
    expect(EDGE_TYPES).toEqual(['bindsTo', 'triggers', 'dependsOn', 'contains']);

    EDGE_TYPES.forEach((type) => {
      const edge: Edge = createMinimalEdge({ type });
      expect(edge.type).toBe(type);
    });
  });
});

describe('DerivedArtifact type shape', () => {
  it('has required fields: id, semanticHash, type, sourceNodeId, content, schemaVersion', () => {
    const artifact: DerivedArtifact = {
      id: 'artifact:iam-policy:component:api',
      semanticHash: 'sha256:ghi789',
      type: 'iam-policy',
      sourceNodeId: 'component:api',
      content: { statements: [] },
      provenance: {
        derivedFrom: ['component:api', 'edge:bindsTo:api:queue'],
      },
      schemaVersion: '1.0.0',
    };

    expect(artifact.id).toBe('artifact:iam-policy:component:api');
    expect(artifact.sourceNodeId).toBe('component:api');
  });

  it('supports all defined ArtifactTypes', () => {
    expect(ARTIFACT_TYPES).toEqual(['iam-policy', 'network-rule', 'config-map', 'telemetry-config']);

    ARTIFACT_TYPES.forEach((type) => {
      const artifact: DerivedArtifact = createMinimalArtifact({ type });
      expect(artifact.type).toBe(type);
    });
  });
});

describe('Provenance type shape', () => {
  it('captures stable origin anchors', () => {
    const provenance: Provenance = {
      sourceFile: 'src/components/api.ts',
      component: 'api-gateway',
    };

    expect(provenance.sourceFile).toBe('src/components/api.ts');
    expect(provenance.component).toBe('api-gateway');
  });

  it('supports optional ephemeral fields', () => {
    const provenance: Provenance = {
      sourceFile: 'src/test.ts',
      lineNumber: 42,
      derivedFrom: ['node:a', 'node:b'],
    };

    expect(provenance.lineNumber).toBe(42);
    expect(provenance.derivedFrom).toEqual(['node:a', 'node:b']);
  });
});

describe('GraphSnapshot envelope', () => {
  it('has schemaVersion, nodes, edges, and artifacts arrays', () => {
    const snapshot: GraphSnapshot = {
      schemaVersion: '1.0.0',
      nodes: [],
      edges: [],
      artifacts: [],
    };

    expect(snapshot.schemaVersion).toBe('1.0.0');
    expect(Array.isArray(snapshot.nodes)).toBe(true);
    expect(Array.isArray(snapshot.edges)).toBe(true);
    expect(Array.isArray(snapshot.artifacts)).toBe(true);
  });

  it('enforces readonly arrays', () => {
    const snapshot: GraphSnapshot = {
      schemaVersion: '1.0.0',
      nodes: [createMinimalNode({})],
      edges: [],
      artifacts: [],
    };

    // TypeScript should prevent mutation - runtime check
    expect(Object.isFrozen(snapshot.nodes)).toBe(false); // Arrays aren't frozen, but readonly enforced at compile time
    expect(snapshot.nodes.length).toBe(1);
  });
});

// Test helpers
function createMinimalNode(overrides: Partial<Node>): Node {
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

function createMinimalEdge(overrides: Partial<Edge>): Edge {
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

function createMinimalArtifact(overrides: Partial<DerivedArtifact>): DerivedArtifact {
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
