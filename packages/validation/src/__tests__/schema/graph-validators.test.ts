import { describe, it, expect } from 'vitest';
import {
  validateNodeSchema,
  validateEdgeSchema,
  validateArtifactSchema,
  validateSnapshotSchema,
} from '../../schema/graph-validators';

describe('graph-validators', () => {
  const validProvenance = {
    sourceFile: 'test.ts',
  };

  describe('validateNodeSchema', () => {
    const validNode = {
      id: 'component:my/path',
      semanticHash: 'sha256:abc123',
      type: 'component',
      provenance: validProvenance,
      metadata: { label: 'test' },
      schemaVersion: '1.0.0',
    };

    it('validates a correct node', () => {
      const result = validateNodeSchema(validNode);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('rejects non-object input', () => {
      const result = validateNodeSchema(null);
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe('invalid-input-type');
    });

    it('rejects missing id', () => {
      const result = validateNodeSchema({ ...validNode, id: undefined });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === '$.id')).toBe(true);
    });

    it('rejects invalid id format', () => {
      const result = validateNodeSchema({ ...validNode, id: 'invalid' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === 'invalid-node-id')).toBe(true);
    });

    it('rejects missing semanticHash', () => {
      const result = validateNodeSchema({ ...validNode, semanticHash: undefined });
      expect(result.valid).toBe(false);
    });

    it('rejects invalid type', () => {
      const result = validateNodeSchema({ ...validNode, type: 'invalid' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === 'invalid-enum-value')).toBe(true);
    });

    it('rejects missing provenance', () => {
      const result = validateNodeSchema({ ...validNode, provenance: undefined });
      expect(result.valid).toBe(false);
    });

    it('rejects missing metadata', () => {
      const result = validateNodeSchema({ ...validNode, metadata: undefined });
      expect(result.valid).toBe(false);
    });

    it('rejects invalid schemaVersion', () => {
      const result = validateNodeSchema({ ...validNode, schemaVersion: '2.0.0' });
      expect(result.valid).toBe(false);
    });

    it('rejects unknown fields in strict mode', () => {
      const result = validateNodeSchema({ ...validNode, extra: 'field' }, { strict: true });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === 'unknown-field')).toBe(true);
    });

    it('allows unknown fields in non-strict mode', () => {
      const result = validateNodeSchema({ ...validNode, extra: 'field' }, { strict: false });
      expect(result.valid).toBe(true);
    });
  });

  describe('validateEdgeSchema', () => {
    const validEdge = {
      id: 'edge:bindsTo:component:source:component:target',
      semanticHash: 'sha256:abc123',
      type: 'bindsTo',
      source: 'component:source',
      target: 'component:target',
      provenance: validProvenance,
      metadata: { bindingConfig: {} },
      schemaVersion: '1.0.0',
    };

    it('validates a correct edge', () => {
      const result = validateEdgeSchema(validEdge);
      expect(result.valid).toBe(true);
    });

    it('rejects invalid edge id format', () => {
      const result = validateEdgeSchema({ ...validEdge, id: 'not-an-edge' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === 'invalid-edge-id')).toBe(true);
    });

    it('rejects missing source', () => {
      const result = validateEdgeSchema({ ...validEdge, source: undefined });
      expect(result.valid).toBe(false);
    });

    it('rejects missing target', () => {
      const result = validateEdgeSchema({ ...validEdge, target: undefined });
      expect(result.valid).toBe(false);
    });

    it('rejects invalid type', () => {
      const result = validateEdgeSchema({ ...validEdge, type: 'invalid-type' });
      expect(result.valid).toBe(false);
    });
  });

  describe('validateArtifactSchema', () => {
    const validArtifact = {
      id: 'artifact:iam-policy:component:source',
      semanticHash: 'sha256:abc123',
      type: 'iam-policy',
      sourceNodeId: 'component:source',
      content: { statements: [] },
      provenance: validProvenance,
      schemaVersion: '1.0.0',
    };

    it('validates a correct artifact', () => {
      const result = validateArtifactSchema(validArtifact);
      expect(result.valid).toBe(true);
    });

    it('rejects invalid artifact id format', () => {
      const result = validateArtifactSchema({ ...validArtifact, id: 'not-an-artifact' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === 'invalid-artifact-id')).toBe(true);
    });

    it('rejects missing sourceNodeId', () => {
      const result = validateArtifactSchema({ ...validArtifact, sourceNodeId: undefined });
      expect(result.valid).toBe(false);
    });

    it('rejects missing content', () => {
      const result = validateArtifactSchema({ ...validArtifact, content: undefined });
      expect(result.valid).toBe(false);
    });

    it('rejects invalid type', () => {
      const result = validateArtifactSchema({ ...validArtifact, type: 'invalid-type' });
      expect(result.valid).toBe(false);
    });
  });

  describe('validateSnapshotSchema', () => {
    const validSnapshot = {
      schemaVersion: '1.0.0',
      nodes: [
        {
          id: 'component:test',
          semanticHash: 'sha256:abc',
          type: 'component',
          provenance: validProvenance,
          metadata: {},
          schemaVersion: '1.0.0',
        },
      ],
      edges: [],
      artifacts: [],
    };

    it('validates a correct snapshot', () => {
      const result = validateSnapshotSchema(validSnapshot);
      expect(result.valid).toBe(true);
    });

    it('rejects non-object input', () => {
      const result = validateSnapshotSchema(null);
      expect(result.valid).toBe(false);
    });

    it('rejects invalid schemaVersion', () => {
      const result = validateSnapshotSchema({ ...validSnapshot, schemaVersion: '2.0.0' });
      expect(result.valid).toBe(false);
    });

    it('rejects non-array nodes', () => {
      const result = validateSnapshotSchema({ ...validSnapshot, nodes: {} });
      expect(result.valid).toBe(false);
    });

    it('rejects non-array edges', () => {
      const result = validateSnapshotSchema({ ...validSnapshot, edges: 'not-array' });
      expect(result.valid).toBe(false);
    });

    it('rejects non-array artifacts', () => {
      const result = validateSnapshotSchema({ ...validSnapshot, artifacts: null });
      expect(result.valid).toBe(false);
    });

    it('validates nested nodes and reports errors with correct paths', () => {
      const result = validateSnapshotSchema({
        ...validSnapshot,
        nodes: [{ id: 'invalid', type: 'bad' }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path.startsWith('$.nodes[0]'))).toBe(true);
    });

    it('validates nested edges with correct paths', () => {
      const result = validateSnapshotSchema({
        ...validSnapshot,
        edges: [{ id: 'invalid' }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path.startsWith('$.edges[0]'))).toBe(true);
    });

    it('validates nested artifacts with correct paths', () => {
      const result = validateSnapshotSchema({
        ...validSnapshot,
        artifacts: [{ id: 'invalid' }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path.startsWith('$.artifacts[0]'))).toBe(true);
    });
  });
});
