import { Graph } from './graph';
import { canonicalStringify } from './canonicalization';
import { validateSnapshot } from './validation';
import { ValidationError } from './errors';
import type { GraphSnapshot } from './types';

/**
 * Serializes a Graph to a deterministic JSON string.
 * Uses canonical ordering and key sorting for byte-stable output.
 */
export function serializeGraph(graph: Graph): string {
  const snapshot = graph.toSnapshot();
  return canonicalStringify(snapshot);
}

/**
 * Deserializes a JSON string to a Graph.
 * Validates the snapshot before constructing the graph.
 *
 * @throws ValidationError if the JSON is invalid
 * @throws SyntaxError if the JSON is malformed
 */
export function deserializeGraph(json: string): Graph {
  const parsed: unknown = JSON.parse(json);

  // Validate the snapshot structure
  const result = validateSnapshot(parsed);
  if (!result.valid) {
    const firstError = result.errors[0];
    throw new ValidationError(firstError.path, firstError.rule);
  }

  const snapshot = parsed as GraphSnapshot;
  const graph = new Graph();

  // Add nodes first (edges depend on nodes)
  for (const node of snapshot.nodes) {
    graph.addNode(node);
  }

  // Add edges (will validate integrity)
  for (const edge of snapshot.edges) {
    graph.addEdge(edge);
  }

  // Add artifacts
  for (const artifact of snapshot.artifacts) {
    graph.addArtifact(artifact);
  }

  return graph;
}
