import { describe, it, expect } from 'vitest';
import {
  validateNode,
  validateEdge,
  validateArtifact,
  validateSnapshot,
} from '../validation';
import { ValidationError } from '../errors';
import type { Node, Edge, DerivedArtifact, GraphSnapshot } from '../types';

// Valid fixtures
function validNode(): Node {
  return {
    id: 'component:test',
    semanticHash: 'sha256:abc123',
    type: 'component',
    provenance: { sourceFile: 'test.ts' },
    metadata: { properties: {} },
    schemaVersion: '1.0.0',
  };
}

function validEdge(): Edge {
  return {
    id: 'edge:bindsTo:component:a:component:b',
    semanticHash: 'sha256:def456',
    type: 'bindsTo',
    source: 'component:a',
    target: 'component:b',
    provenance: { sourceFile: 'test.ts' },
    metadata: { bindingConfig: {} },
    schemaVersion: '1.0.0',
  };
}

function validArtifact(): DerivedArtifact {
  return {
    id: 'artifact:iam-policy:component:test',
    semanticHash: 'sha256:ghi789',
    type: 'iam-policy',
    sourceNodeId: 'component:test',
    content: {},
    provenance: { derivedFrom: [] },
    schemaVersion: '1.0.0',
  };
}

describe('validateNode', () => {
  it('accepts valid nodes', () => {
    const result = validateNode(validNode());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  describe('required fields', () => {
    it('rejects missing id', () => {
      const node = { ...validNode(), id: undefined };
      const result = validateNode(node);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe('$.id');
    });

    it('rejects missing type', () => {
      const node = { ...validNode(), type: undefined };
      const result = validateNode(node);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe('$.type');
    });

    it('rejects missing semanticHash', () => {
      const node = { ...validNode(), semanticHash: undefined };
      const result = validateNode(node);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe('$.semanticHash');
    });

    it('rejects missing schemaVersion', () => {
      const node = { ...validNode(), schemaVersion: undefined };
      const result = validateNode(node);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe('$.schemaVersion');
    });

    it('rejects missing provenance', () => {
      const node = { ...validNode(), provenance: undefined };
      const result = validateNode(node);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe('$.provenance');
    });

    it('rejects missing metadata', () => {
      const node = { ...validNode(), metadata: undefined };
      const result = validateNode(node);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe('$.metadata');
    });
  });

  describe('type validation', () => {
    it('rejects invalid NodeType', () => {
      const node = { ...validNode(), type: 'invalid' as any };
      const result = validateNode(node);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe('$.type');
    });

    it('rejects invalid schemaVersion', () => {
      const node = { ...validNode(), schemaVersion: '2.0.0' as any };
      const result = validateNode(node);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe('$.schemaVersion');
    });
  });

  describe('id format validation', () => {
    it('rejects invalid node ID format', () => {
      const node = { ...validNode(), id: 'invalid-format' };
      const result = validateNode(node);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe('$.id');
    });
  });

  describe('strict mode (unknown fields)', () => {
    it('rejects unknown fields in strict mode', () => {
      const node = { ...validNode(), unknownField: 'value' };
      const result = validateNode(node, { strict: true });
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe('$.unknownField');
    });

    it('allows unknown fields when not in strict mode', () => {
      const node = { ...validNode(), unknownField: 'value' };
      const result = validateNode(node, { strict: false });
      expect(result.valid).toBe(true);
    });
  });
});

describe('validateEdge', () => {
  it('accepts valid edges', () => {
    const result = validateEdge(validEdge());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  describe('required fields', () => {
    it('rejects missing source', () => {
      const edge = { ...validEdge(), source: undefined };
      const result = validateEdge(edge);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe('$.source');
    });

    it('rejects missing target', () => {
      const edge = { ...validEdge(), target: undefined };
      const result = validateEdge(edge);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe('$.target');
    });
  });

  describe('type validation', () => {
    it('rejects invalid EdgeType', () => {
      const edge = { ...validEdge(), type: 'invalid' as any };
      const result = validateEdge(edge);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe('$.type');
    });
  });

  describe('id format validation', () => {
    it('rejects invalid edge ID format', () => {
      const edge = { ...validEdge(), id: 'invalid-format' };
      const result = validateEdge(edge);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe('$.id');
    });
  });
});

describe('validateArtifact', () => {
  it('accepts valid artifacts', () => {
    const result = validateArtifact(validArtifact());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  describe('required fields', () => {
    it('rejects missing sourceNodeId', () => {
      const artifact = { ...validArtifact(), sourceNodeId: undefined };
      const result = validateArtifact(artifact);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe('$.sourceNodeId');
    });

    it('rejects missing content', () => {
      const artifact = { ...validArtifact(), content: undefined };
      const result = validateArtifact(artifact);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe('$.content');
    });
  });

  describe('type validation', () => {
    it('rejects invalid ArtifactType', () => {
      const artifact = { ...validArtifact(), type: 'invalid' as any };
      const result = validateArtifact(artifact);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe('$.type');
    });
  });

  describe('id format validation', () => {
    it('rejects invalid artifact ID format', () => {
      const artifact = { ...validArtifact(), id: 'invalid-format' };
      const result = validateArtifact(artifact);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe('$.id');
    });
  });
});

describe('validateSnapshot', () => {
  it('accepts valid empty snapshot', () => {
    const snapshot: GraphSnapshot = {
      schemaVersion: '1.0.0',
      nodes: [],
      edges: [],
      artifacts: [],
    };
    const result = validateSnapshot(snapshot);
    expect(result.valid).toBe(true);
  });

  it('accepts valid populated snapshot', () => {
    const snapshot: GraphSnapshot = {
      schemaVersion: '1.0.0',
      nodes: [validNode()],
      edges: [],
      artifacts: [],
    };
    const result = validateSnapshot(snapshot);
    expect(result.valid).toBe(true);
  });

  describe('required fields', () => {
    it('rejects missing schemaVersion', () => {
      const snapshot = { nodes: [], edges: [], artifacts: [] };
      const result = validateSnapshot(snapshot);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe('$.schemaVersion');
    });

    it('rejects missing nodes array', () => {
      const snapshot = { schemaVersion: '1.0.0', edges: [], artifacts: [] };
      const result = validateSnapshot(snapshot);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe('$.nodes');
    });
  });

  it('validates nested nodes', () => {
    const snapshot = {
      schemaVersion: '1.0.0',
      nodes: [{ id: 'invalid' }], // Invalid node
      edges: [],
      artifacts: [],
    };
    const result = validateSnapshot(snapshot);
    expect(result.valid).toBe(false);
    expect(result.errors[0].path).toMatch(/^\$\.nodes\[0\]/);
  });

  it('rejects non-object input', () => {
    const result = validateSnapshot('not an object');
    expect(result.valid).toBe(false);
    expect(result.errors[0].path).toBe('$');
  });

  it('rejects null input', () => {
    const result = validateSnapshot(null);
    expect(result.valid).toBe(false);
  });
});
