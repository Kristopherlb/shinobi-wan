import type { Provenance } from './provenance';

/** Runtime-available array of valid artifact types */
export const ARTIFACT_TYPES = [
  'iam-policy',
  'network-rule',
  'config-map',
  'telemetry-config',
] as const;

/** Union type derived from the runtime constant */
export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

/**
 * A DerivedArtifact is a backend-neutral representation
 * of a desired effect (IAM policy, network rule, etc.)
 * derived from nodes and edges by binders.
 */
export interface DerivedArtifact {
  /** Stable ID: artifact:{type}:{sourceNodeId} */
  readonly id: string;

  /** SHA-256 of semanticProjection(artifact) */
  readonly semanticHash: string;

  /** Artifact type discriminator */
  readonly type: ArtifactType;

  /** Node ID this artifact was derived from */
  readonly sourceNodeId: string;

  /** Artifact content (type-specific structure) */
  readonly content: Readonly<Record<string, unknown>>;

  /** Origin tracking (includes derivedFrom) */
  readonly provenance: Provenance;

  /** Schema version for forward compatibility */
  readonly schemaVersion: '1.0.0';
}
