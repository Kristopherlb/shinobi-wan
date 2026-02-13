import type { Node, Edge } from './types';
import { computeSemanticHash } from './id-generation';

/**
 * Creates a test Node with sensible defaults and auto-computed semanticHash.
 *
 * Only `id` and `type` are required. All other fields have test defaults.
 */
export function createTestNode(
  overrides: { id: string; type: Node['type'] } & Partial<Node>
): Node {
  const base = {
    schemaVersion: '1.0.0' as const,
    provenance: { sourceFile: 'test.ts' },
    metadata: { properties: {} },
    semanticHash: '',
  };
  const node = { ...base, ...overrides };
  if (!node.semanticHash) {
    node.semanticHash = computeSemanticHash(node);
  }
  return node as Node;
}

/**
 * Creates a test Edge with sensible defaults and auto-computed semanticHash.
 *
 * `id`, `type`, `source`, and `target` are required. All other fields have test defaults.
 */
export function createTestEdge(
  overrides: { id: string; type: Edge['type']; source: string; target: string } & Partial<Edge>
): Edge {
  const base = {
    schemaVersion: '1.0.0' as const,
    provenance: { sourceFile: 'test.ts' },
    metadata: { bindingConfig: {} },
    semanticHash: '',
  };
  const edge = { ...base, ...overrides };
  if (!edge.semanticHash) {
    edge.semanticHash = computeSemanticHash(edge);
  }
  return edge as Edge;
}
