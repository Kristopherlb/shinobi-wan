import type { GraphSnapshot, Node, Edge, DerivedArtifact } from '@shinobi/ir';
import { compareNodes, compareEdges, compareArtifacts } from '@shinobi/ir';
import { createError, createResult, type ValidationError, type ValidationResult } from '../errors';

/**
 * Checks if an array is in canonical order according to a comparator.
 */
export function isCanonicallyOrdered<T>(
  items: ReadonlyArray<T>,
  comparator: (a: T, b: T) => number
): boolean {
  for (let i = 1; i < items.length; i++) {
    if (comparator(items[i - 1], items[i]) > 0) {
      return false;
    }
  }
  return true;
}

/**
 * Validates that nodes are in canonical order.
 */
function validateNodeOrdering(nodes: ReadonlyArray<Node>): ValidationError[] {
  if (!isCanonicallyOrdered(nodes, compareNodes)) {
    return [
      createError({
        path: '$.nodes',
        rule: 'non-canonical-ordering',
        message: 'Nodes are not in canonical order (sorted by type, then id)',
        severity: 'error',
        remediation: 'Sort nodes using the canonical ordering: primary by type (lexicographic), secondary by id (lexicographic)',
        kernelLaw: 'KL-001',
      }),
    ];
  }
  return [];
}

/**
 * Validates that edges are in canonical order.
 */
function validateEdgeOrdering(edges: ReadonlyArray<Edge>): ValidationError[] {
  if (!isCanonicallyOrdered(edges, compareEdges)) {
    return [
      createError({
        path: '$.edges',
        rule: 'non-canonical-ordering',
        message: 'Edges are not in canonical order (sorted by type, source, target, then id)',
        severity: 'error',
        remediation: 'Sort edges using the canonical ordering: type → source → target → id (all lexicographic)',
        kernelLaw: 'KL-001',
      }),
    ];
  }
  return [];
}

/**
 * Validates that artifacts are in canonical order.
 */
function validateArtifactOrdering(artifacts: ReadonlyArray<DerivedArtifact>): ValidationError[] {
  if (!isCanonicallyOrdered(artifacts, compareArtifacts)) {
    return [
      createError({
        path: '$.artifacts',
        rule: 'non-canonical-ordering',
        message: 'Artifacts are not in canonical order (sorted by type, then id)',
        severity: 'error',
        remediation: 'Sort artifacts using the canonical ordering: primary by type (lexicographic), secondary by id (lexicographic)',
        kernelLaw: 'KL-001',
      }),
    ];
  }
  return [];
}

/**
 * Validates that a graph snapshot has canonical ordering.
 * Identical inputs must produce identical byte-stable outputs.
 */
export function validateCanonicalOrdering(snapshot: GraphSnapshot): ValidationResult {
  const errors: ValidationError[] = [];

  errors.push(...validateNodeOrdering(snapshot.nodes));
  errors.push(...validateEdgeOrdering(snapshot.edges));
  errors.push(...validateArtifactOrdering(snapshot.artifacts));

  return createResult(errors);
}
