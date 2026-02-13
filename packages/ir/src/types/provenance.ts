/**
 * Provenance captures the origin of a graph element.
 * Includes both stable anchors (for semantic hashing) and
 * ephemeral traces (for diagnostics only).
 */
export interface Provenance {
  /** Source file path (stable anchor) */
  readonly sourceFile?: string;

  /** Component name (stable anchor) */
  readonly component?: string;

  /** Line number (ephemeral - excluded from semantic hash) */
  readonly lineNumber?: number;

  /** IDs of entities this was derived from (for artifacts) */
  readonly derivedFrom?: readonly string[];
}
