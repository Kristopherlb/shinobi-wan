/**
 * Deep-freeze utility (KL-009).
 *
 * Recursively freezes an object and all nested objects/arrays.
 * Idempotent: calling on an already-frozen object is a no-op.
 */
export function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  if (Object.isFrozen(obj)) {
    return obj;
  }

  Object.freeze(obj);

  if (Array.isArray(obj)) {
    for (const item of obj) {
      deepFreeze(item);
    }
  } else {
    for (const value of Object.values(obj as Record<string, unknown>)) {
      deepFreeze(value);
    }
  }

  return obj;
}
