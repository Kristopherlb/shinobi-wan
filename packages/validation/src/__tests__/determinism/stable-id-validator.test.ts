import { describe, it, expect } from 'vitest';
import {
  validateStableNodeId,
  validateStableEdgeId,
  validateStableArtifactId,
  validateSnapshotIds,
} from '../../determinism/stable-id-validator';
import type { GraphSnapshot, Node, Edge, DerivedArtifact } from '@shinobi/ir';

describe('stable-id-validator', () => {
  describe('validateStableNodeId', () => {
    it('returns empty array for correctly formatted node ID', () => {
      const node: Node = {
        id: 'component:my-service',
        semanticHash: 'sha256:abc',
        type: 'component',
        provenance: { sourceFile: 'test.ts' },
        metadata: { properties: {} },
        schemaVersion: '1.0.0',
      };

      const errors = validateStableNodeId(node, 0);
      expect(errors).toEqual([]);
    });

    it('returns error when ID type does not match node type', () => {
      const node: Node = {
        id: 'platform:my-service',
        semanticHash: 'sha256:abc',
        type: 'component', // Mismatch!
        provenance: { sourceFile: 'test.ts' },
        metadata: { properties: {} },
        schemaVersion: '1.0.0',
      };

      const errors = validateStableNodeId(node, 0);
      expect(errors).toHaveLength(1);
      expect(errors[0].rule).toBe('id-type-mismatch');
      expect(errors[0].path).toBe('$.nodes[0].id');
    });

    it('returns error for ID without colon', () => {
      const node: Node = {
        id: 'no-colon-id',
        semanticHash: 'sha256:abc',
        type: 'component',
        provenance: { sourceFile: 'test.ts' },
        metadata: { properties: {} },
        schemaVersion: '1.0.0',
      };

      const errors = validateStableNodeId(node, 0);
      expect(errors).toHaveLength(1);
      expect(errors[0].rule).toBe('invalid-id-format');
    });

    it('provides remediation guidance', () => {
      const node: Node = {
        id: 'wrong-type:path',
        semanticHash: 'sha256:abc',
        type: 'component',
        provenance: { sourceFile: 'test.ts' },
        metadata: { properties: {} },
        schemaVersion: '1.0.0',
      };

      const errors = validateStableNodeId(node, 0);
      expect(errors[0].remediation).toBeDefined();
    });
  });

  describe('validateStableEdgeId', () => {
    it('returns empty array for correctly formatted edge ID', () => {
      const edge: Edge = {
        id: 'edge:bindsTo:component:source:component:target',
        semanticHash: 'sha256:abc',
        type: 'bindsTo',
        source: 'component:source',
        target: 'component:target',
        provenance: { sourceFile: 'test.ts' },
        metadata: { bindingConfig: {} },
        schemaVersion: '1.0.0',
      };

      const errors = validateStableEdgeId(edge, 0);
      expect(errors).toEqual([]);
    });

    it('returns error when ID type does not match edge type', () => {
      const edge: Edge = {
        id: 'edge:triggers:component:a:component:b', // triggers in ID
        semanticHash: 'sha256:abc',
        type: 'bindsTo', // but bindsTo in type
        source: 'component:a',
        target: 'component:b',
        provenance: { sourceFile: 'test.ts' },
        metadata: { bindingConfig: {} },
        schemaVersion: '1.0.0',
      };

      const errors = validateStableEdgeId(edge, 0);
      expect(errors).toHaveLength(1);
      expect(errors[0].rule).toBe('id-type-mismatch');
    });

    it('returns error when ID source does not match edge source', () => {
      const edge: Edge = {
        id: 'edge:bindsTo:component:wrong:component:target',
        semanticHash: 'sha256:abc',
        type: 'bindsTo',
        source: 'component:correct', // Mismatch!
        target: 'component:target',
        provenance: { sourceFile: 'test.ts' },
        metadata: { bindingConfig: {} },
        schemaVersion: '1.0.0',
      };

      const errors = validateStableEdgeId(edge, 0);
      expect(errors).toHaveLength(1);
      expect(errors[0].rule).toBe('id-source-mismatch');
    });

    it('returns error when ID target does not match edge target', () => {
      const edge: Edge = {
        id: 'edge:bindsTo:component:source:component:wrong',
        semanticHash: 'sha256:abc',
        type: 'bindsTo',
        source: 'component:source',
        target: 'component:correct', // Mismatch!
        provenance: { sourceFile: 'test.ts' },
        metadata: { bindingConfig: {} },
        schemaVersion: '1.0.0',
      };

      const errors = validateStableEdgeId(edge, 0);
      expect(errors).toHaveLength(1);
      expect(errors[0].rule).toBe('id-target-mismatch');
    });

    it('returns error for ID not starting with edge:', () => {
      const edge: Edge = {
        id: 'not-edge:bindsTo:a:b',
        semanticHash: 'sha256:abc',
        type: 'bindsTo',
        source: 'component:a',
        target: 'component:b',
        provenance: { sourceFile: 'test.ts' },
        metadata: { bindingConfig: {} },
        schemaVersion: '1.0.0',
      };

      const errors = validateStableEdgeId(edge, 0);
      expect(errors).toHaveLength(1);
      expect(errors[0].rule).toBe('invalid-id-format');
    });
  });

  describe('validateStableArtifactId', () => {
    it('returns empty array for correctly formatted artifact ID', () => {
      const artifact: DerivedArtifact = {
        id: 'artifact:iam-policy:component:source',
        semanticHash: 'sha256:abc',
        type: 'iam-policy',
        sourceNodeId: 'component:source',
        content: {},
        provenance: { sourceFile: 'test.ts' },
        schemaVersion: '1.0.0',
      };

      const errors = validateStableArtifactId(artifact, 0);
      expect(errors).toEqual([]);
    });

    it('returns error when ID type does not match artifact type', () => {
      const artifact: DerivedArtifact = {
        id: 'artifact:network-config:component:source',
        semanticHash: 'sha256:abc',
        type: 'iam-policy', // Mismatch!
        sourceNodeId: 'component:source',
        content: {},
        provenance: { sourceFile: 'test.ts' },
        schemaVersion: '1.0.0',
      };

      const errors = validateStableArtifactId(artifact, 0);
      expect(errors).toHaveLength(1);
      expect(errors[0].rule).toBe('id-type-mismatch');
    });

    it('returns error when ID sourceNodeId does not match artifact sourceNodeId', () => {
      const artifact: DerivedArtifact = {
        id: 'artifact:iam-policy:component:wrong',
        semanticHash: 'sha256:abc',
        type: 'iam-policy',
        sourceNodeId: 'component:correct', // Mismatch!
        content: {},
        provenance: { sourceFile: 'test.ts' },
        schemaVersion: '1.0.0',
      };

      const errors = validateStableArtifactId(artifact, 0);
      expect(errors).toHaveLength(1);
      expect(errors[0].rule).toBe('id-source-mismatch');
    });
  });

  describe('validateSnapshotIds', () => {
    it('validates snapshot with correct IDs', () => {
      const snapshot: GraphSnapshot = {
        schemaVersion: '1.0.0',
        nodes: [
          {
            id: 'component:a',
            semanticHash: 'sha256:abc',
            type: 'component',
            provenance: { sourceFile: 'test.ts' },
            metadata: { properties: {} },
            schemaVersion: '1.0.0',
          },
        ],
        edges: [
          {
            id: 'edge:bindsTo:component:a:component:a',
            semanticHash: 'sha256:abc',
            type: 'bindsTo',
            source: 'component:a',
            target: 'component:a',
            provenance: { sourceFile: 'test.ts' },
            metadata: { bindingConfig: {} },
            schemaVersion: '1.0.0',
          },
        ],
        artifacts: [
          {
            id: 'artifact:iam-policy:component:a',
            semanticHash: 'sha256:abc',
            type: 'iam-policy',
            sourceNodeId: 'component:a',
            content: {},
            provenance: { sourceFile: 'test.ts' },
            schemaVersion: '1.0.0',
          },
        ],
      };

      const result = validateSnapshotIds(snapshot);
      expect(result.valid).toBe(true);
    });

    it('collects all ID consistency errors', () => {
      const snapshot: GraphSnapshot = {
        schemaVersion: '1.0.0',
        nodes: [
          {
            id: 'wrong:a',
            semanticHash: 'sha256:abc',
            type: 'component',
            provenance: { sourceFile: 'test.ts' },
            metadata: { properties: {} },
            schemaVersion: '1.0.0',
          },
        ],
        edges: [
          {
            id: 'edge:triggers:component:a:component:b', // type mismatch
            semanticHash: 'sha256:abc',
            type: 'bindsTo',
            source: 'component:a',
            target: 'component:b',
            provenance: { sourceFile: 'test.ts' },
            metadata: { bindingConfig: {} },
            schemaVersion: '1.0.0',
          },
        ],
        artifacts: [
          {
            id: 'artifact:network-config:component:a', // type mismatch
            semanticHash: 'sha256:abc',
            type: 'iam-policy',
            sourceNodeId: 'component:a',
            content: {},
            provenance: { sourceFile: 'test.ts' },
            schemaVersion: '1.0.0',
          },
        ],
      };

      const result = validateSnapshotIds(snapshot);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3);
    });
  });
});
