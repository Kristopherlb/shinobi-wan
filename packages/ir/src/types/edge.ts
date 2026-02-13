import type { Provenance } from './provenance';

/** Runtime-available array of valid edge types */
export const EDGE_TYPES = [
  'bindsTo',
  'triggers',
  'dependsOn',
  'contains',
] as const;

/** Union type derived from the runtime constant */
export type EdgeType = (typeof EDGE_TYPES)[number];

/** Edge metadata containing binding configuration */
export interface EdgeMetadata {
  readonly bindingConfig: Readonly<Record<string, unknown>>;
}

/**
 * An Edge represents a typed relationship between nodes.
 * Examples: bindsTo, triggers, dependsOn, contains
 */
export interface Edge {
  /** Stable ID: edge:{type}:{sourceId}:{targetId} */
  readonly id: string;

  /** SHA-256 of semanticProjection(edge) */
  readonly semanticHash: string;

  /** Edge type discriminator */
  readonly type: EdgeType;

  /** Source node ID */
  readonly source: string;

  /** Target node ID */
  readonly target: string;

  /** Origin tracking */
  readonly provenance: Provenance;

  /** Edge-specific metadata */
  readonly metadata: EdgeMetadata;

  /** Schema version for forward compatibility */
  readonly schemaVersion: '1.0.0';
}
