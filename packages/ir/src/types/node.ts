import type { Provenance } from './provenance';

/** Runtime-available array of valid node types */
export const NODE_TYPES = [
  'component',
  'capability',
  'platform',
  'config',
  'secret',
] as const;

/** Union type derived from the runtime constant */
export type NodeType = (typeof NODE_TYPES)[number];

/** Node metadata containing properties */
export interface NodeMetadata {
  readonly properties: Readonly<Record<string, unknown>>;
  /** Display label (ephemeral - excluded from semantic hash) */
  readonly label?: string;
}

/**
 * A Node represents a typed object in the graph.
 * Examples: component, capability, platform, config, secret
 */
export interface Node {
  /** Stable address: {type}:{canonicalPath} */
  readonly id: string;

  /** SHA-256 of semanticProjection(node) */
  readonly semanticHash: string;

  /** Node type discriminator */
  readonly type: NodeType;

  /** Origin tracking */
  readonly provenance: Provenance;

  /** Node-specific metadata */
  readonly metadata: NodeMetadata;

  /** Schema version for forward compatibility */
  readonly schemaVersion: '1.0.0';
}
