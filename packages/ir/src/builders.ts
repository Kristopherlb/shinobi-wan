import type { Node, Edge } from './types';
import { computeSemanticHash } from './id-generation';

/**
 * Creates a Node for runtime code paths with auto-computed semanticHash.
 */
export function createNode(
  overrides: { id: string; type: Node['type'] } & Partial<Node>,
): Node {
  const base = {
    schemaVersion: '1.0.0' as const,
    provenance: { sourceFile: 'runtime' },
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
 * Creates an Edge for runtime code paths with auto-computed semanticHash.
 */
export function createEdge(
  overrides: { id: string; type: Edge['type']; source: string; target: string } & Partial<Edge>,
): Edge {
  const base = {
    schemaVersion: '1.0.0' as const,
    provenance: { sourceFile: 'runtime' },
    metadata: { bindingConfig: {} },
    semanticHash: '',
  };
  const edge = { ...base, ...overrides };
  if (!edge.semanticHash) {
    edge.semanticHash = computeSemanticHash(edge);
  }
  return edge as Edge;
}
