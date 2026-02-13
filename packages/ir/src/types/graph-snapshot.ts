import type { Node } from './node';
import type { Edge } from './edge';
import type { DerivedArtifact } from './derived-artifact';

/**
 * GraphSnapshot is the serializable envelope containing
 * the complete state of a graph at a point in time.
 */
export interface GraphSnapshot {
  /** Envelope schema version */
  readonly schemaVersion: '1.0.0';

  /** All nodes in canonical order */
  readonly nodes: ReadonlyArray<Node>;

  /** All edges in canonical order */
  readonly edges: ReadonlyArray<Edge>;

  /** All derived artifacts in canonical order */
  readonly artifacts: ReadonlyArray<DerivedArtifact>;
}
