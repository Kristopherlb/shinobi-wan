/**
 * Canonicalization module for deterministic JSON serialization.
 *
 * IMPORTANT: Do NOT rely on JSON.stringify key ordering.
 * This module implements explicit recursive canonicalization
 * to ensure byte-stable output regardless of input key order.
 */

/** Type marker for canonicalized values */
export type CanonicalValue =
  | null
  | boolean
  | number
  | string
  | CanonicalValue[]
  | { [key: string]: CanonicalValue };

/**
 * Recursively canonicalizes a value for deterministic serialization.
 *
 * - Objects: keys sorted lexicographically at every level
 * - Arrays: order preserved (arrays are ordered by definition)
 * - Numbers: -0 normalized to 0
 * - Primitives: preserved as-is
 *
 * @throws Error for undefined, functions, symbols
 */
export function canonicalize(value: unknown): CanonicalValue {
  if (value === null) {
    return null;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return normalizeNumber(value);
  }

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (typeof value === 'object') {
    const sorted: Record<string, CanonicalValue> = {};
    const keys = Object.keys(value).sort();

    for (const key of keys) {
      sorted[key] = canonicalize((value as Record<string, unknown>)[key]);
    }

    return sorted;
  }

  throw new Error(`Cannot canonicalize value of type: ${typeof value}`);
}

/**
 * Normalizes a number for canonical representation.
 * - Converts -0 to 0
 * - Preserves all other numbers as-is
 */
function normalizeNumber(n: number): number {
  if (Object.is(n, -0)) {
    return 0;
  }
  return n;
}

/**
 * Produces a deterministic JSON string from any value.
 * Keys are sorted lexicographically at every nesting level.
 *
 * @param value - The value to stringify
 * @returns JSON string with 2-space indentation
 */
export function canonicalStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value), null, 2);
}
