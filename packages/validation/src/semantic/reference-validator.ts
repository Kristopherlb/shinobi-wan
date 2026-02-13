import type { GraphSnapshot, Edge, DerivedArtifact } from '@shinobi/ir';
import { createError, createResult, type ValidationError, type ValidationResult } from '../errors';

/**
 * Validates that an edge's source and target nodes exist.
 */
export function validateEdgeReferences(
  edge: Edge,
  index: number,
  nodeIds: Set<string>
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!nodeIds.has(edge.source)) {
    errors.push(
      createError({
        path: `$.edges[${index}].source`,
        rule: 'dangling-edge-source',
        message: `Edge source '${edge.source}' references non-existent node`,
        severity: 'error',
        remediation: 'Ensure the source node exists in the graph before creating edges',
      })
    );
  }

  if (!nodeIds.has(edge.target)) {
    errors.push(
      createError({
        path: `$.edges[${index}].target`,
        rule: 'dangling-edge-target',
        message: `Edge target '${edge.target}' references non-existent node`,
        severity: 'error',
        remediation: 'Ensure the target node exists in the graph before creating edges',
      })
    );
  }

  return errors;
}

/**
 * Validates that an artifact's source node exists.
 */
export function validateArtifactReferences(
  artifact: DerivedArtifact,
  index: number,
  nodeIds: Set<string>
): ValidationError[] {
  if (!nodeIds.has(artifact.sourceNodeId)) {
    return [
      createError({
        path: `$.artifacts[${index}].sourceNodeId`,
        rule: 'dangling-artifact-source',
        message: `Artifact sourceNodeId '${artifact.sourceNodeId}' references non-existent node`,
        severity: 'error',
        remediation: 'Ensure the source node exists in the graph before creating artifacts',
      }),
    ];
  }

  return [];
}

/**
 * Validates referential integrity of a graph snapshot.
 * - All edge source/target references point to existing nodes
 * - All artifact sourceNodeId references point to existing nodes
 */
export function validateReferences(snapshot: GraphSnapshot): ValidationResult {
  const errors: ValidationError[] = [];

  // Build node ID set for O(1) lookup
  const nodeIds = new Set(snapshot.nodes.map((n) => n.id));

  // Validate edge references
  for (let i = 0; i < snapshot.edges.length; i++) {
    errors.push(...validateEdgeReferences(snapshot.edges[i], i, nodeIds));
  }

  // Validate artifact references
  for (let i = 0; i < snapshot.artifacts.length; i++) {
    errors.push(...validateArtifactReferences(snapshot.artifacts[i], i, nodeIds));
  }

  return createResult(errors);
}
