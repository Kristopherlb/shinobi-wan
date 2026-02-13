import type { IBinder } from '@shinobi/kernel';
import type { EdgeType, NodeType } from '@shinobi/ir';

/**
 * Formats an edge pattern as a lookup key.
 */
function patternKey(edgeType: EdgeType, sourceType: NodeType, targetType: NodeType): string {
  return `${edgeType}:${sourceType}:${targetType}`;
}

/**
 * Registry that collects binders and validates no two binders
 * claim the same edge pattern.
 *
 * Produces a ReadonlyArray<IBinder> for the kernel.
 */
export class BinderRegistry {
  private readonly binders: IBinder[] = [];
  private readonly patternMap = new Map<string, string>(); // pattern key → binder id

  /**
   * Register a binder. Throws if any of its edge patterns
   * conflict with an already-registered binder.
   */
  register(binder: IBinder): void {
    for (const pattern of binder.supportedEdgeTypes) {
      const key = patternKey(pattern.edgeType, pattern.sourceType, pattern.targetType);
      const existingId = this.patternMap.get(key);
      if (existingId !== undefined) {
        throw new Error(
          `Duplicate edge pattern: binder "${binder.id}" conflicts with ` +
          `binder "${existingId}" on pattern ${key}`
        );
      }
    }

    // Claim all patterns
    for (const pattern of binder.supportedEdgeTypes) {
      const key = patternKey(pattern.edgeType, pattern.sourceType, pattern.targetType);
      this.patternMap.set(key, binder.id);
    }

    this.binders.push(binder);
  }

  /**
   * Returns all registered binders as a read-only array
   * suitable for passing to the kernel.
   */
  getBinders(): ReadonlyArray<IBinder> {
    return this.binders;
  }

  /**
   * Finds the binder that handles the given edge pattern.
   * Returns undefined if no binder is registered for the pattern.
   */
  findBinder(
    edgeType: EdgeType,
    sourceType: NodeType,
    targetType: NodeType
  ): IBinder | undefined {
    const key = patternKey(edgeType, sourceType, targetType);
    const binderId = this.patternMap.get(key);
    if (binderId === undefined) {
      return undefined;
    }
    return this.binders.find((b) => b.id === binderId);
  }
}
