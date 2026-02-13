import { describe, it, expect } from 'vitest';
import { validateCanonicalOrdering, isCanonicallyOrdered } from '../../determinism/ordering-validator';
import type { GraphSnapshot, Node, Edge, DerivedArtifact } from '@shinobi/ir';

describe('ordering-validator', () => {
  const makeNode = (type: string, id: string): Node => ({
    id,
    semanticHash: 'sha256:abc',
    type: type as 'component' | 'platform' | 'config' | 'secret' | 'capability',
    provenance: { sourceFile: 'test.ts' },
    metadata: { properties: {} },
    schemaVersion: '1.0.0',
  });

  const makeEdge = (type: string, source: string, target: string): Edge => ({
    id: `edge:${type}:${source}:${target}`,
    semanticHash: 'sha256:abc',
    type: type as 'bindsTo' | 'triggers' | 'dependsOn' | 'contains',
    source,
    target,
    provenance: { sourceFile: 'test.ts' },
    metadata: { bindingConfig: {} },
    schemaVersion: '1.0.0',
  });

  const makeArtifact = (type: string, sourceNodeId: string): DerivedArtifact => ({
    id: `artifact:${type}:${sourceNodeId}`,
    semanticHash: 'sha256:abc',
    type: type as 'iam-policy' | 'network-rule' | 'config-map' | 'telemetry-config',
    sourceNodeId,
    content: {},
    provenance: { sourceFile: 'test.ts' },
    schemaVersion: '1.0.0',
  });

  describe('isCanonicallyOrdered', () => {
    it('returns true for empty arrays', () => {
      expect(isCanonicallyOrdered<Node>([], (a, b) => a.id.localeCompare(b.id))).toBe(true);
    });

    it('returns true for single element', () => {
      const nodes = [makeNode('component', 'component:a')];
      expect(isCanonicallyOrdered(nodes, (a, b) => a.id.localeCompare(b.id))).toBe(true);
    });

    it('returns true for correctly ordered nodes', () => {
      const nodes = [
        makeNode('component', 'component:a'),
        makeNode('component', 'component:b'),
        makeNode('platform', 'platform:x'),
      ];
      expect(isCanonicallyOrdered(nodes, (a, b) => {
        const typeCompare = a.type.localeCompare(b.type);
        return typeCompare !== 0 ? typeCompare : a.id.localeCompare(b.id);
      })).toBe(true);
    });

    it('returns false for incorrectly ordered nodes', () => {
      const nodes = [
        makeNode('platform', 'platform:x'),
        makeNode('component', 'component:a'),
      ];
      expect(isCanonicallyOrdered(nodes, (a, b) => {
        const typeCompare = a.type.localeCompare(b.type);
        return typeCompare !== 0 ? typeCompare : a.id.localeCompare(b.id);
      })).toBe(false);
    });
  });

  describe('validateCanonicalOrdering', () => {
    it('validates correctly ordered snapshot', () => {
      const snapshot: GraphSnapshot = {
        schemaVersion: '1.0.0',
        nodes: [
          makeNode('component', 'component:a'),
          makeNode('component', 'component:b'),
        ],
        edges: [
          makeEdge('bindsTo', 'component:a', 'component:b'),
        ],
        artifacts: [
          makeArtifact('iam-policy', 'component:a'),
        ],
      };

      const result = validateCanonicalOrdering(snapshot);
      expect(result.valid).toBe(true);
    });

    it('returns error for misordered nodes', () => {
      const snapshot: GraphSnapshot = {
        schemaVersion: '1.0.0',
        nodes: [
          makeNode('component', 'component:b'),
          makeNode('component', 'component:a'),
        ],
        edges: [],
        artifacts: [],
      };

      const result = validateCanonicalOrdering(snapshot);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === 'non-canonical-ordering')).toBe(true);
      expect(result.errors.some((e) => e.path === '$.nodes')).toBe(true);
    });

    it('returns error for misordered edges', () => {
      const snapshot: GraphSnapshot = {
        schemaVersion: '1.0.0',
        nodes: [
          makeNode('component', 'component:a'),
          makeNode('component', 'component:b'),
          makeNode('component', 'component:c'),
        ],
        edges: [
          makeEdge('triggers', 'component:a', 'component:b'),
          makeEdge('bindsTo', 'component:a', 'component:c'),
        ],
        artifacts: [],
      };

      const result = validateCanonicalOrdering(snapshot);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === '$.edges')).toBe(true);
    });

    it('returns error for misordered artifacts', () => {
      const snapshot: GraphSnapshot = {
        schemaVersion: '1.0.0',
        nodes: [
          makeNode('component', 'component:a'),
        ],
        edges: [],
        artifacts: [
          makeArtifact('network-config', 'component:a'),
          makeArtifact('iam-policy', 'component:a'),
        ],
      };

      const result = validateCanonicalOrdering(snapshot);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === '$.artifacts')).toBe(true);
    });

    it('reports all ordering violations', () => {
      const snapshot: GraphSnapshot = {
        schemaVersion: '1.0.0',
        nodes: [
          makeNode('platform', 'platform:x'),
          makeNode('component', 'component:a'),
        ],
        edges: [
          makeEdge('triggers', 'component:a', 'platform:x'),
          makeEdge('bindsTo', 'component:a', 'platform:x'),
        ],
        artifacts: [
          makeArtifact('network-config', 'component:a'),
          makeArtifact('iam-policy', 'component:a'),
        ],
      };

      const result = validateCanonicalOrdering(snapshot);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3); // nodes, edges, artifacts
    });

    it('includes kernel law reference', () => {
      const snapshot: GraphSnapshot = {
        schemaVersion: '1.0.0',
        nodes: [
          makeNode('component', 'component:b'),
          makeNode('component', 'component:a'),
        ],
        edges: [],
        artifacts: [],
      };

      const result = validateCanonicalOrdering(snapshot);
      expect(result.errors[0].kernelLaw).toBe('KL-001');
    });

    it('provides remediation guidance', () => {
      const snapshot: GraphSnapshot = {
        schemaVersion: '1.0.0',
        nodes: [
          makeNode('component', 'component:b'),
          makeNode('component', 'component:a'),
        ],
        edges: [],
        artifacts: [],
      };

      const result = validateCanonicalOrdering(snapshot);
      expect(result.errors[0].remediation).toContain('canonical');
    });
  });
});
