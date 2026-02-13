import type { GraphSnapshot, Node, Edge, DerivedArtifact } from '@shinobi/ir';
import { computeSemanticHash } from '@shinobi/ir';
import { createError, createResult, type ValidationError, type ValidationResult } from '../errors';

/**
 * Entity with a semantic hash (node, edge, or artifact).
 */
type HashableEntity = Node | Edge | DerivedArtifact;

/**
 * Validates that an entity's semantic hash matches its content.
 */
export function validateSemanticHash(
  entity: HashableEntity,
  path: string
): ValidationError[] {
  const expectedHash = computeSemanticHash(entity);

  if (entity.semanticHash !== expectedHash) {
    return [
      createError({
        path: `${path}.semanticHash`,
        rule: 'semantic-hash-mismatch',
        message: `Semantic hash mismatch: stored '${entity.semanticHash}', expected '${expectedHash}'`,
        severity: 'error',
        remediation: 'Recompute the semantic hash using computeSemanticHash() after any content modification',
        kernelLaw: 'KL-001',
      }),
    ];
  }

  return [];
}

/**
 * Validates all semantic hashes in a graph snapshot.
 */
export function validateSnapshotHashes(snapshot: GraphSnapshot): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate node hashes
  for (let i = 0; i < snapshot.nodes.length; i++) {
    errors.push(...validateSemanticHash(snapshot.nodes[i], `$.nodes[${i}]`));
  }

  // Validate edge hashes
  for (let i = 0; i < snapshot.edges.length; i++) {
    errors.push(...validateSemanticHash(snapshot.edges[i], `$.edges[${i}]`));
  }

  // Validate artifact hashes
  for (let i = 0; i < snapshot.artifacts.length; i++) {
    errors.push(...validateSemanticHash(snapshot.artifacts[i], `$.artifacts[${i}]`));
  }

  return createResult(errors);
}
