import { describe, it, expect } from 'vitest';
import { validateReferences, validateEdgeReferences, validateArtifactReferences } from '../../semantic/reference-validator';
import type { GraphSnapshot } from '@shinobi/ir';

describe('reference-validator', () => {
  const makeNode = (id: string) => ({
    id,
    semanticHash: 'sha256:abc',
    type: 'component' as const,
    provenance: { sourceFile: 'test.ts' },
    metadata: { properties: {} },
    schemaVersion: '1.0.0' as const,
  });

  const makeEdge = (id: string, source: string, target: string) => ({
    id,
    semanticHash: 'sha256:abc',
    type: 'bindsTo' as const,
    source,
    target,
    provenance: { sourceFile: 'test.ts' },
    metadata: { bindingConfig: {} },
    schemaVersion: '1.0.0' as const,
  });

  const makeArtifact = (id: string, sourceNodeId: string) => ({
    id,
    semanticHash: 'sha256:abc',
    type: 'iam-policy' as const,
    sourceNodeId,
    content: {},
    provenance: { sourceFile: 'test.ts' },
    schemaVersion: '1.0.0' as const,
  });

  describe('validateEdgeReferences', () => {
    it('returns empty array for valid edge references', () => {
      const nodeIds = new Set(['component:a', 'component:b']);
      const edge = makeEdge('edge:bindsTo:a:b', 'component:a', 'component:b');

      const errors = validateEdgeReferences(edge, 0, nodeIds);
      expect(errors).toEqual([]);
    });

    it('returns error for missing source node', () => {
      const nodeIds = new Set(['component:b']);
      const edge = makeEdge('edge:bindsTo:a:b', 'component:a', 'component:b');

      const errors = validateEdgeReferences(edge, 0, nodeIds);
      expect(errors).toHaveLength(1);
      expect(errors[0].rule).toBe('dangling-edge-source');
      expect(errors[0].path).toBe('$.edges[0].source');
    });

    it('returns error for missing target node', () => {
      const nodeIds = new Set(['component:a']);
      const edge = makeEdge('edge:bindsTo:a:b', 'component:a', 'component:b');

      const errors = validateEdgeReferences(edge, 0, nodeIds);
      expect(errors).toHaveLength(1);
      expect(errors[0].rule).toBe('dangling-edge-target');
      expect(errors[0].path).toBe('$.edges[0].target');
    });

    it('returns errors for both missing source and target', () => {
      const nodeIds = new Set<string>();
      const edge = makeEdge('edge:bindsTo:a:b', 'component:a', 'component:b');

      const errors = validateEdgeReferences(edge, 0, nodeIds);
      expect(errors).toHaveLength(2);
    });
  });

  describe('validateArtifactReferences', () => {
    it('returns empty array for valid artifact reference', () => {
      const nodeIds = new Set(['component:source']);
      const artifact = makeArtifact('artifact:iam-policy:source', 'component:source');

      const errors = validateArtifactReferences(artifact, 0, nodeIds);
      expect(errors).toEqual([]);
    });

    it('returns error for missing source node', () => {
      const nodeIds = new Set<string>();
      const artifact = makeArtifact('artifact:iam-policy:source', 'component:source');

      const errors = validateArtifactReferences(artifact, 0, nodeIds);
      expect(errors).toHaveLength(1);
      expect(errors[0].rule).toBe('dangling-artifact-source');
      expect(errors[0].path).toBe('$.artifacts[0].sourceNodeId');
    });
  });

  describe('validateReferences', () => {
    it('returns valid result for snapshot with valid references', () => {
      const snapshot: GraphSnapshot = {
        schemaVersion: '1.0.0',
        nodes: [makeNode('component:a'), makeNode('component:b')],
        edges: [makeEdge('edge:bindsTo:a:b', 'component:a', 'component:b')],
        artifacts: [makeArtifact('artifact:iam-policy:a', 'component:a')],
      };

      const result = validateReferences(snapshot);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('returns errors for dangling edge references', () => {
      const snapshot: GraphSnapshot = {
        schemaVersion: '1.0.0',
        nodes: [makeNode('component:a')],
        edges: [makeEdge('edge:bindsTo:a:b', 'component:a', 'component:missing')],
        artifacts: [],
      };

      const result = validateReferences(snapshot);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === 'dangling-edge-target')).toBe(true);
    });

    it('returns errors for dangling artifact references', () => {
      const snapshot: GraphSnapshot = {
        schemaVersion: '1.0.0',
        nodes: [],
        edges: [],
        artifacts: [makeArtifact('artifact:iam-policy:missing', 'component:missing')],
      };

      const result = validateReferences(snapshot);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === 'dangling-artifact-source')).toBe(true);
    });

    it('collects all referential integrity errors', () => {
      const snapshot: GraphSnapshot = {
        schemaVersion: '1.0.0',
        nodes: [],
        edges: [
          makeEdge('edge:bindsTo:a:b', 'component:a', 'component:b'),
          makeEdge('edge:bindsTo:c:d', 'component:c', 'component:d'),
        ],
        artifacts: [makeArtifact('artifact:iam-policy:x', 'component:x')],
      };

      const result = validateReferences(snapshot);
      expect(result.valid).toBe(false);
      // 2 edges × 2 dangling refs each + 1 artifact = 5 errors
      expect(result.errors).toHaveLength(5);
    });
  });
});
