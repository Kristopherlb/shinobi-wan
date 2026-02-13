import { describe, it, expect } from 'vitest';
import {
  validateSemanticHash,
  validateSnapshotHashes,
} from '../../determinism/hash-validator';
import { computeSemanticHash } from '@shinobi/ir';
import type { GraphSnapshot, Node, Edge, DerivedArtifact } from '@shinobi/ir';

describe('hash-validator', () => {
  const makeNode = (id: string, hash?: string): Node => {
    const node: Omit<Node, 'semanticHash'> = {
      id,
      type: 'component',
      provenance: { sourceFile: 'test.ts' },
      metadata: { properties: {} },
      schemaVersion: '1.0.0',
    };
    const actualHash = hash ?? computeSemanticHash(node);
    return { ...node, semanticHash: actualHash } as Node;
  };

  const makeEdge = (source: string, target: string, hash?: string): Edge => {
    const edge: Omit<Edge, 'semanticHash'> = {
      id: `edge:bindsTo:${source}:${target}`,
      type: 'bindsTo',
      source,
      target,
      provenance: { sourceFile: 'test.ts' },
      metadata: { bindingConfig: {} },
      schemaVersion: '1.0.0',
    };
    const actualHash = hash ?? computeSemanticHash(edge);
    return { ...edge, semanticHash: actualHash } as Edge;
  };

  const makeArtifact = (sourceNodeId: string, hash?: string): DerivedArtifact => {
    const artifact: Omit<DerivedArtifact, 'semanticHash'> = {
      id: `artifact:iam-policy:${sourceNodeId}`,
      type: 'iam-policy',
      sourceNodeId,
      content: { statements: [] },
      provenance: { sourceFile: 'test.ts' },
      schemaVersion: '1.0.0',
    };
    const actualHash = hash ?? computeSemanticHash(artifact);
    return { ...artifact, semanticHash: actualHash } as DerivedArtifact;
  };

  describe('validateSemanticHash', () => {
    it('returns empty array for correct hash', () => {
      const node = makeNode('component:test');
      const errors = validateSemanticHash(node, '$.nodes[0]');
      expect(errors).toEqual([]);
    });

    it('returns error for incorrect hash', () => {
      const node = makeNode('component:test', 'sha256:incorrect');
      const errors = validateSemanticHash(node, '$.nodes[0]');
      expect(errors).toHaveLength(1);
      expect(errors[0].rule).toBe('semantic-hash-mismatch');
      expect(errors[0].kernelLaw).toBe('KL-001');
    });

    it('includes expected hash in error', () => {
      const node = makeNode('component:test', 'sha256:incorrect');
      const errors = validateSemanticHash(node, '$.nodes[0]');
      expect(errors[0].message).toContain('sha256:');
    });

    it('validates edge hash', () => {
      const edge = makeEdge('component:a', 'component:b');
      const errors = validateSemanticHash(edge, '$.edges[0]');
      expect(errors).toEqual([]);
    });

    it('detects incorrect edge hash', () => {
      const edge = makeEdge('component:a', 'component:b', 'sha256:wrong');
      const errors = validateSemanticHash(edge, '$.edges[0]');
      expect(errors).toHaveLength(1);
    });

    it('validates artifact hash', () => {
      const artifact = makeArtifact('component:source');
      const errors = validateSemanticHash(artifact, '$.artifacts[0]');
      expect(errors).toEqual([]);
    });

    it('detects incorrect artifact hash', () => {
      const artifact = makeArtifact('component:source', 'sha256:wrong');
      const errors = validateSemanticHash(artifact, '$.artifacts[0]');
      expect(errors).toHaveLength(1);
    });
  });

  describe('validateSnapshotHashes', () => {
    it('validates snapshot with correct hashes', () => {
      const snapshot: GraphSnapshot = {
        schemaVersion: '1.0.0',
        nodes: [makeNode('component:a'), makeNode('component:b')],
        edges: [makeEdge('component:a', 'component:b')],
        artifacts: [makeArtifact('component:a')],
      };

      const result = validateSnapshotHashes(snapshot);
      expect(result.valid).toBe(true);
    });

    it('returns error for node with incorrect hash', () => {
      const snapshot: GraphSnapshot = {
        schemaVersion: '1.0.0',
        nodes: [makeNode('component:a', 'sha256:bad')],
        edges: [],
        artifacts: [],
      };

      const result = validateSnapshotHashes(snapshot);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === '$.nodes[0].semanticHash')).toBe(true);
    });

    it('returns error for edge with incorrect hash', () => {
      const snapshot: GraphSnapshot = {
        schemaVersion: '1.0.0',
        nodes: [makeNode('component:a'), makeNode('component:b')],
        edges: [makeEdge('component:a', 'component:b', 'sha256:bad')],
        artifacts: [],
      };

      const result = validateSnapshotHashes(snapshot);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === '$.edges[0].semanticHash')).toBe(true);
    });

    it('returns error for artifact with incorrect hash', () => {
      const snapshot: GraphSnapshot = {
        schemaVersion: '1.0.0',
        nodes: [makeNode('component:a')],
        edges: [],
        artifacts: [makeArtifact('component:a', 'sha256:bad')],
      };

      const result = validateSnapshotHashes(snapshot);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === '$.artifacts[0].semanticHash')).toBe(true);
    });

    it('collects all hash mismatches', () => {
      const snapshot: GraphSnapshot = {
        schemaVersion: '1.0.0',
        nodes: [
          makeNode('component:a', 'sha256:bad1'),
          makeNode('component:b', 'sha256:bad2'),
        ],
        edges: [makeEdge('component:a', 'component:b', 'sha256:bad3')],
        artifacts: [makeArtifact('component:a', 'sha256:bad4')],
      };

      const result = validateSnapshotHashes(snapshot);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(4);
    });

    it('provides remediation guidance', () => {
      const snapshot: GraphSnapshot = {
        schemaVersion: '1.0.0',
        nodes: [makeNode('component:a', 'sha256:bad')],
        edges: [],
        artifacts: [],
      };

      const result = validateSnapshotHashes(snapshot);
      expect(result.errors[0].remediation).toContain('Recompute');
    });
  });
});
