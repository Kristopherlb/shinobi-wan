import type { Node, Edge, DerivedArtifact } from './types';

/**
 * Compares two nodes for canonical ordering.
 *
 * Sort order:
 * 1. Primary: type (lexicographic)
 * 2. Tie-breaker: id (lexicographic, always unique)
 *
 * This comparator is total - no two distinct nodes compare equal.
 */
export function compareNodes(a: Node, b: Node): number {
  // Primary: sort by type
  const typeCompare = a.type.localeCompare(b.type);
  if (typeCompare !== 0) {
    return typeCompare;
  }

  // Tie-breaker: sort by id (always unique, ensures total ordering)
  return a.id.localeCompare(b.id);
}

/**
 * Compares two edges for canonical ordering.
 *
 * Sort order:
 * 1. Primary: type (lexicographic)
 * 2. Secondary: source (lexicographic)
 * 3. Tertiary: target (lexicographic)
 * 4. Final tie-breaker: id (lexicographic, always unique)
 *
 * This comparator is total - no two distinct edges compare equal.
 */
export function compareEdges(a: Edge, b: Edge): number {
  // Primary: sort by type
  let cmp = a.type.localeCompare(b.type);
  if (cmp !== 0) {
    return cmp;
  }

  // Secondary: sort by source
  cmp = a.source.localeCompare(b.source);
  if (cmp !== 0) {
    return cmp;
  }

  // Tertiary: sort by target
  cmp = a.target.localeCompare(b.target);
  if (cmp !== 0) {
    return cmp;
  }

  // Final tie-breaker: sort by id (ensures total ordering)
  return a.id.localeCompare(b.id);
}

/**
 * Compares two artifacts for canonical ordering.
 *
 * Sort order:
 * 1. Primary: type (lexicographic)
 * 2. Tie-breaker: id (lexicographic, always unique)
 *
 * This comparator is total - no two distinct artifacts compare equal.
 */
export function compareArtifacts(a: DerivedArtifact, b: DerivedArtifact): number {
  // Primary: sort by type
  const typeCompare = a.type.localeCompare(b.type);
  if (typeCompare !== 0) {
    return typeCompare;
  }

  // Tie-breaker: sort by id (always unique, ensures total ordering)
  return a.id.localeCompare(b.id);
}
