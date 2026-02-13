import type { GraphSnapshot, Node, Edge, DerivedArtifact } from '@shinobi/ir';
import { createError, createResult, type ValidationError, type ValidationResult } from '../errors';

/**
 * Validates that a node's ID is consistent with its type.
 * Node ID format: {type}:{path}
 */
export function validateStableNodeId(node: Node, index: number): ValidationError[] {
  const colonIndex = node.id.indexOf(':');

  if (colonIndex === -1) {
    return [
      createError({
        path: `$.nodes[${index}].id`,
        rule: 'invalid-id-format',
        message: `Node ID '${node.id}' missing type prefix (expected format: {type}:{path})`,
        severity: 'error',
        remediation: 'Use createNodeId(type, path) to generate stable node IDs',
        kernelLaw: 'KL-001',
      }),
    ];
  }

  const idType = node.id.substring(0, colonIndex);

  if (idType !== node.type) {
    return [
      createError({
        path: `$.nodes[${index}].id`,
        rule: 'id-type-mismatch',
        message: `Node ID type '${idType}' does not match node type '${node.type}'`,
        severity: 'error',
        remediation: 'Node ID must start with the node type. Use createNodeId(type, path) to ensure consistency.',
        kernelLaw: 'KL-001',
      }),
    ];
  }

  return [];
}

/**
 * Validates that an edge's ID is consistent with its type, source, and target.
 * Edge ID format: edge:{type}:{source}:{target}
 */
export function validateStableEdgeId(edge: Edge, index: number): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!edge.id.startsWith('edge:')) {
    return [
      createError({
        path: `$.edges[${index}].id`,
        rule: 'invalid-id-format',
        message: `Edge ID '${edge.id}' must start with 'edge:'`,
        severity: 'error',
        remediation: 'Use createEdgeId(type, source, target) to generate stable edge IDs',
        kernelLaw: 'KL-001',
      }),
    ];
  }

  // Parse edge ID: edge:{type}:{source}:{target}
  const rest = edge.id.substring(5); // Remove 'edge:'
  const typeEndIndex = rest.indexOf(':');

  if (typeEndIndex === -1) {
    return [
      createError({
        path: `$.edges[${index}].id`,
        rule: 'invalid-id-format',
        message: `Edge ID '${edge.id}' has invalid format (expected: edge:{type}:{source}:{target})`,
        severity: 'error',
        remediation: 'Use createEdgeId(type, source, target) to generate stable edge IDs',
        kernelLaw: 'KL-001',
      }),
    ];
  }

  const idType = rest.substring(0, typeEndIndex);
  const remainder = rest.substring(typeEndIndex + 1);

  // Check type consistency
  if (idType !== edge.type) {
    errors.push(
      createError({
        path: `$.edges[${index}].id`,
        rule: 'id-type-mismatch',
        message: `Edge ID type '${idType}' does not match edge type '${edge.type}'`,
        severity: 'error',
        remediation: 'Edge ID must contain the correct edge type. Use createEdgeId(type, source, target).',
        kernelLaw: 'KL-001',
      })
    );
  }

  // Check source consistency
  // The remainder should be {source}:{target}, but source and target can contain colons
  // So we check if remainder starts with source
  if (!remainder.startsWith(edge.source)) {
    errors.push(
      createError({
        path: `$.edges[${index}].id`,
        rule: 'id-source-mismatch',
        message: `Edge ID source does not match edge source '${edge.source}'`,
        severity: 'error',
        remediation: 'Edge ID must contain the correct source. Use createEdgeId(type, source, target).',
        kernelLaw: 'KL-001',
      })
    );
  }

  // Check target consistency
  // The ID should end with the target
  if (!remainder.endsWith(edge.target)) {
    errors.push(
      createError({
        path: `$.edges[${index}].id`,
        rule: 'id-target-mismatch',
        message: `Edge ID target does not match edge target '${edge.target}'`,
        severity: 'error',
        remediation: 'Edge ID must contain the correct target. Use createEdgeId(type, source, target).',
        kernelLaw: 'KL-001',
      })
    );
  }

  return errors;
}

/**
 * Validates that an artifact's ID is consistent with its type and source node.
 * Artifact ID format: artifact:{type}:{sourceNodeId}
 */
export function validateStableArtifactId(artifact: DerivedArtifact, index: number): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!artifact.id.startsWith('artifact:')) {
    return [
      createError({
        path: `$.artifacts[${index}].id`,
        rule: 'invalid-id-format',
        message: `Artifact ID '${artifact.id}' must start with 'artifact:'`,
        severity: 'error',
        remediation: 'Use createArtifactId(type, sourceNodeId) to generate stable artifact IDs',
        kernelLaw: 'KL-001',
      }),
    ];
  }

  // Parse artifact ID: artifact:{type}:{sourceNodeId}
  const rest = artifact.id.substring(9); // Remove 'artifact:'
  const typeEndIndex = rest.indexOf(':');

  if (typeEndIndex === -1) {
    return [
      createError({
        path: `$.artifacts[${index}].id`,
        rule: 'invalid-id-format',
        message: `Artifact ID '${artifact.id}' has invalid format (expected: artifact:{type}:{sourceNodeId})`,
        severity: 'error',
        remediation: 'Use createArtifactId(type, sourceNodeId) to generate stable artifact IDs',
        kernelLaw: 'KL-001',
      }),
    ];
  }

  const idType = rest.substring(0, typeEndIndex);
  const idSourceNodeId = rest.substring(typeEndIndex + 1);

  // Check type consistency
  if (idType !== artifact.type) {
    errors.push(
      createError({
        path: `$.artifacts[${index}].id`,
        rule: 'id-type-mismatch',
        message: `Artifact ID type '${idType}' does not match artifact type '${artifact.type}'`,
        severity: 'error',
        remediation: 'Artifact ID must contain the correct artifact type. Use createArtifactId(type, sourceNodeId).',
        kernelLaw: 'KL-001',
      })
    );
  }

  // Check sourceNodeId consistency
  if (idSourceNodeId !== artifact.sourceNodeId) {
    errors.push(
      createError({
        path: `$.artifacts[${index}].id`,
        rule: 'id-source-mismatch',
        message: `Artifact ID sourceNodeId '${idSourceNodeId}' does not match artifact sourceNodeId '${artifact.sourceNodeId}'`,
        severity: 'error',
        remediation: 'Artifact ID must contain the correct sourceNodeId. Use createArtifactId(type, sourceNodeId).',
        kernelLaw: 'KL-001',
      })
    );
  }

  return errors;
}

/**
 * Validates all ID consistency in a graph snapshot.
 */
export function validateSnapshotIds(snapshot: GraphSnapshot): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate node IDs
  for (let i = 0; i < snapshot.nodes.length; i++) {
    errors.push(...validateStableNodeId(snapshot.nodes[i], i));
  }

  // Validate edge IDs
  for (let i = 0; i < snapshot.edges.length; i++) {
    errors.push(...validateStableEdgeId(snapshot.edges[i], i));
  }

  // Validate artifact IDs
  for (let i = 0; i < snapshot.artifacts.length; i++) {
    errors.push(...validateStableArtifactId(snapshot.artifacts[i], i));
  }

  return createResult(errors);
}
