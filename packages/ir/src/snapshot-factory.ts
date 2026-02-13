import type { Node, Edge, DerivedArtifact, GraphSnapshot } from './types';
import { compareNodes, compareEdges, compareArtifacts } from './ordering';

/**
 * Creates a GraphSnapshot with canonical ordering enforced.
 *
 * This is the canonical way to construct a snapshot outside of Graph.toSnapshot().
 * Nodes, edges, and artifacts are sorted deterministically regardless of input order.
 */
export function createSnapshot(
  nodes: ReadonlyArray<Node>,
  edges: ReadonlyArray<Edge>,
  artifacts: ReadonlyArray<DerivedArtifact> = []
): GraphSnapshot {
  return {
    schemaVersion: '1.0.0',
    nodes: [...nodes].sort(compareNodes),
    edges: [...edges].sort(compareEdges),
    artifacts: [...artifacts].sort(compareArtifacts),
  };
}
