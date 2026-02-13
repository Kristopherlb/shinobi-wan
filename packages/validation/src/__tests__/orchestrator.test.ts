import { describe, it, expect } from 'vitest';
import {
  validateGraph,
  validateCapabilityContract,
  validateIntent,
  validateViolation,
} from '../orchestrator';
import { computeSemanticHash } from '@shinobi/ir';
import type { GraphSnapshot, Node, Edge, DerivedArtifact } from '@shinobi/ir';

describe('orchestrator', () => {
  // Helper to create valid nodes with correct hashes
  const makeValidNode = (type: 'component' | 'platform', path: string): Node => {
    const base = {
      id: `${type}:${path}`,
      type,
      provenance: { sourceFile: 'test.ts' },
      metadata: { properties: {} },
      schemaVersion: '1.0.0' as const,
    };
    return {
      ...base,
      semanticHash: computeSemanticHash(base),
    };
  };

  const makeValidEdge = (source: string, target: string): Edge => {
    const base = {
      id: `edge:bindsTo:${source}:${target}`,
      type: 'bindsTo' as const,
      source,
      target,
      provenance: { sourceFile: 'test.ts' },
      metadata: { bindingConfig: {} },
      schemaVersion: '1.0.0' as const,
    };
    return {
      ...base,
      semanticHash: computeSemanticHash(base),
    };
  };

  const makeValidArtifact = (sourceNodeId: string): DerivedArtifact => {
    const base = {
      id: `artifact:iam-policy:${sourceNodeId}`,
      type: 'iam-policy' as const,
      sourceNodeId,
      content: { statements: [] },
      provenance: { sourceFile: 'test.ts' },
      schemaVersion: '1.0.0' as const,
    };
    return {
      ...base,
      semanticHash: computeSemanticHash(base),
    };
  };

  describe('validateGraph', () => {
    it('validates a correct graph snapshot', () => {
      const nodeA = makeValidNode('component', 'service-a');
      const nodeB = makeValidNode('component', 'service-b');
      const edge = makeValidEdge(nodeA.id, nodeB.id);
      const artifact = makeValidArtifact(nodeA.id);

      const snapshot: GraphSnapshot = {
        schemaVersion: '1.0.0',
        nodes: [nodeA, nodeB],
        edges: [edge],
        artifacts: [artifact],
      };

      const result = validateGraph(snapshot);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.schemaVersion).toBe('1.0.0');
    });

    it('rejects non-object input', () => {
      const result = validateGraph(null);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === 'invalid-input-type')).toBe(true);
    });

    it('rejects missing required fields', () => {
      const result = validateGraph({ schemaVersion: '1.0.0' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === '$.nodes')).toBe(true);
    });

    it('validates nested node schema', () => {
      const result = validateGraph({
        schemaVersion: '1.0.0',
        nodes: [{ id: 'invalid' }],
        edges: [],
        artifacts: [],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path.startsWith('$.nodes[0]'))).toBe(true);
    });

    it('validates referential integrity', () => {
      const node = makeValidNode('component', 'a');
      const edge = makeValidEdge(node.id, 'component:nonexistent');

      const snapshot: GraphSnapshot = {
        schemaVersion: '1.0.0',
        nodes: [node],
        edges: [edge],
        artifacts: [],
      };

      const result = validateGraph(snapshot);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === 'dangling-edge-target')).toBe(true);
    });

    it('validates canonical ordering', () => {
      const nodeB = makeValidNode('component', 'b');
      const nodeA = makeValidNode('component', 'a');

      const snapshot: GraphSnapshot = {
        schemaVersion: '1.0.0',
        nodes: [nodeB, nodeA], // Wrong order!
        edges: [],
        artifacts: [],
      };

      const result = validateGraph(snapshot);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === 'non-canonical-ordering')).toBe(true);
    });

    it('validates semantic hashes', () => {
      const node: Node = {
        ...makeValidNode('component', 'test'),
        semanticHash: 'sha256:incorrect',
      };

      const snapshot: GraphSnapshot = {
        schemaVersion: '1.0.0',
        nodes: [node],
        edges: [],
        artifacts: [],
      };

      const result = validateGraph(snapshot);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === 'semantic-hash-mismatch')).toBe(true);
    });

    it('validates stable IDs', () => {
      const node: Node = {
        id: 'platform:test', // Wrong type in ID
        type: 'component',
        semanticHash: 'sha256:abc',
        provenance: { sourceFile: 'test.ts' },
        metadata: { properties: {} },
        schemaVersion: '1.0.0',
      };

      const snapshot: GraphSnapshot = {
        schemaVersion: '1.0.0',
        nodes: [node],
        edges: [],
        artifacts: [],
      };

      const result = validateGraph(snapshot);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === 'id-type-mismatch')).toBe(true);
    });

    it('respects level option: schema only', () => {
      const node = makeValidNode('component', 'test');
      const edge = makeValidEdge(node.id, 'component:nonexistent'); // Dangling!

      const snapshot: GraphSnapshot = {
        schemaVersion: '1.0.0',
        nodes: [node],
        edges: [edge],
        artifacts: [],
      };

      // Schema level should not check references
      const result = validateGraph(snapshot, { level: 'schema' });
      expect(result.valid).toBe(true);
    });

    it('respects level option: semantic', () => {
      const nodeB = makeValidNode('component', 'b');
      const nodeA = makeValidNode('component', 'a');

      const snapshot: GraphSnapshot = {
        schemaVersion: '1.0.0',
        nodes: [nodeB, nodeA], // Wrong order - but semantic level doesn't check
        edges: [],
        artifacts: [],
      };

      // Semantic level should not check ordering
      const result = validateGraph(snapshot, { level: 'semantic' });
      expect(result.valid).toBe(true);
    });

    it('produces deterministic error output', () => {
      const snapshot = {
        schemaVersion: '2.0.0', // Bad
        nodes: 'not-array', // Bad
        edges: null, // Bad
      };

      const result1 = validateGraph(snapshot);
      const result2 = validateGraph(snapshot);

      expect(result1.errors).toEqual(result2.errors);
    });

    it('collects all errors by default', () => {
      const snapshot = {
        schemaVersion: '2.0.0',
        nodes: [{ invalid: true }],
        edges: [],
        artifacts: [],
      };

      const result = validateGraph(snapshot, { collectAll: true });
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('validateCapabilityContract', () => {
    const validContract = {
      id: 'aws:sqs-queue@1.0.0',
      schemaVersion: '1.0.0',
      description: 'SQS queue capability',
      dataShape: { fields: {} },
      actions: ['read', 'write'],
    };

    it('validates a correct capability contract', () => {
      const result = validateCapabilityContract(validContract);
      expect(result.valid).toBe(true);
    });

    it('rejects invalid capability ID format', () => {
      const result = validateCapabilityContract({ ...validContract, id: 'invalid' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === 'invalid-capability-id')).toBe(true);
    });

    it('rejects missing actions', () => {
      const result = validateCapabilityContract({ ...validContract, actions: undefined });
      expect(result.valid).toBe(false);
    });
  });

  describe('validateIntent', () => {
    const validIntent = {
      type: 'iam',
      schemaVersion: '1.0.0',
      sourceEdgeId: 'edge:bindsTo:a:b',
      principal: { nodeRef: 'component:lambda', role: 'function' },
      resource: { nodeRef: 'component:queue', resourceType: 'queue', scope: 'specific' },
      actions: [{ level: 'read', action: 'receiveMessage' }],
    };

    it('validates a correct intent', () => {
      const result = validateIntent(validIntent);
      expect(result.valid).toBe(true);
    });

    it('rejects invalid intent type', () => {
      const result = validateIntent({ ...validIntent, type: 'invalid' });
      expect(result.valid).toBe(false);
    });

    it('detects wildcard resources in IAM intent', () => {
      const intent = {
        ...validIntent,
        resource: { ...validIntent.resource, scope: 'pattern', pattern: '*' },
      };

      const result = validateIntent(intent);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === 'wildcard-resource')).toBe(true);
    });

    it('detects backend handles in intent', () => {
      const intent = {
        ...validIntent,
        resource: { arn: 'arn:aws:sqs:us-east-1:123456789012:queue' },
      };

      const result = validateIntent(intent);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === 'backend-handle-detected')).toBe(true);
    });
  });

  describe('validateViolation', () => {
    const validViolation = {
      id: 'violation:least-privilege:node:test',
      schemaVersion: '1.0.0',
      ruleId: 'least-privilege',
      ruleName: 'Least Privilege',
      severity: 'error',
      target: { type: 'node', id: 'node:test' },
      message: 'Wildcard resource access detected',
      remediation: { summary: 'Use specific resource', autoFixable: false },
      policyPack: 'baseline',
    };

    it('validates a correct violation', () => {
      const result = validateViolation(validViolation);
      expect(result.valid).toBe(true);
    });

    it('rejects invalid violation ID format', () => {
      const result = validateViolation({ ...validViolation, id: 'not-a-violation' });
      expect(result.valid).toBe(false);
    });

    it('rejects invalid severity', () => {
      const result = validateViolation({ ...validViolation, severity: 'critical' });
      expect(result.valid).toBe(false);
    });
  });
});
