import type { Node, Edge, DerivedArtifact, GraphSnapshot } from './types';
import { ConflictError, IntegrityError } from './errors';
import { compareNodes, compareEdges, compareArtifacts } from './ordering';

/**
 * Mutation types for atomic batch operations.
 */
export type GraphMutation =
  | { type: 'addNode'; node: Node }
  | { type: 'addEdge'; edge: Edge }
  | { type: 'addArtifact'; artifact: DerivedArtifact };

/**
 * Result of a batch mutation operation.
 */
export interface MutationResult {
  /** Whether all mutations succeeded */
  readonly success: boolean;
  /** Number of mutations that were applied */
  readonly appliedCount: number;
  /** Number of mutations skipped (idempotent) */
  readonly skippedCount: number;
  /** Errors encountered (empty if success is true) */
  readonly errors: ReadonlyArray<MutationError>;
}

/**
 * Error detail for a failed mutation.
 */
export interface MutationError {
  readonly mutation: GraphMutation;
  readonly error: Error;
}

/**
 * In-memory graph with copy-on-write atomic mutations.
 *
 * Invariants enforced:
 * - Idempotency: Same ID + same semanticHash = no-op
 * - Conflict detection: Same ID + different semanticHash = error
 * - Referential integrity: Edges must reference existing nodes
 * - Deterministic ordering: toSnapshot() always returns canonically ordered data
 */
export class Graph {
  private nodes: Map<string, Node>;
  private edges: Map<string, Edge>;
  private artifacts: Map<string, DerivedArtifact>;

  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
    this.artifacts = new Map();
  }

  /**
   * Adds a node to the graph.
   *
   * @throws ConflictError if node with same ID exists with different semanticHash
   */
  addNode(node: Node): void {
    const existing = this.nodes.get(node.id);
    if (existing) {
      if (existing.semanticHash === node.semanticHash) {
        return; // Idempotent - same content
      }
      throw new ConflictError(node.id, existing.semanticHash, node.semanticHash);
    }
    this.nodes.set(node.id, node);
  }

  /**
   * Adds an edge to the graph.
   *
   * @throws IntegrityError if source or target node does not exist
   * @throws ConflictError if edge with same ID exists with different semanticHash
   */
  addEdge(edge: Edge): void {
    if (!this.nodes.has(edge.source)) {
      throw new IntegrityError(edge.source, edge.id);
    }
    if (!this.nodes.has(edge.target)) {
      throw new IntegrityError(edge.target, edge.id);
    }

    const existing = this.edges.get(edge.id);
    if (existing) {
      if (existing.semanticHash === edge.semanticHash) {
        return; // Idempotent - same content
      }
      throw new ConflictError(edge.id, existing.semanticHash, edge.semanticHash);
    }
    this.edges.set(edge.id, edge);
  }

  /**
   * Adds an artifact to the graph.
   *
   * @throws ConflictError if artifact with same ID exists with different semanticHash
   */
  addArtifact(artifact: DerivedArtifact): void {
    const existing = this.artifacts.get(artifact.id);
    if (existing) {
      if (existing.semanticHash === artifact.semanticHash) {
        return; // Idempotent - same content
      }
      throw new ConflictError(artifact.id, existing.semanticHash, artifact.semanticHash);
    }
    this.artifacts.set(artifact.id, artifact);
  }

  /**
   * Applies a batch of mutations atomically using copy-on-write.
   * On any error, no mutations are applied (rollback).
   */
  applyMutation(mutations: ReadonlyArray<GraphMutation>): MutationResult {
    // Create copies for copy-on-write semantics
    const nodesCopy = new Map(this.nodes);
    const edgesCopy = new Map(this.edges);
    const artifactsCopy = new Map(this.artifacts);

    const errors: MutationError[] = [];
    let appliedCount = 0;
    let skippedCount = 0;

    for (const mutation of mutations) {
      try {
        const wasApplied = this.applyOne(
          mutation,
          nodesCopy,
          edgesCopy,
          artifactsCopy
        );
        if (wasApplied) {
          appliedCount++;
        } else {
          skippedCount++;
        }
      } catch (e) {
        errors.push({ mutation, error: e as Error });
      }
    }

    if (errors.length > 0) {
      // Rollback: don't swap the maps
      return {
        success: false,
        appliedCount: 0,
        skippedCount: 0,
        errors,
      };
    }

    // Commit: swap maps
    this.nodes = nodesCopy;
    this.edges = edgesCopy;
    this.artifacts = artifactsCopy;

    return {
      success: true,
      appliedCount,
      skippedCount,
      errors: [],
    };
  }

  /**
   * Applies a single mutation to the provided maps.
   * @returns true if applied, false if skipped (idempotent)
   */
  private applyOne(
    mutation: GraphMutation,
    nodes: Map<string, Node>,
    edges: Map<string, Edge>,
    artifacts: Map<string, DerivedArtifact>
  ): boolean {
    switch (mutation.type) {
      case 'addNode': {
        const existing = nodes.get(mutation.node.id);
        if (existing) {
          if (existing.semanticHash === mutation.node.semanticHash) {
            return false; // Skipped - idempotent
          }
          throw new ConflictError(
            mutation.node.id,
            existing.semanticHash,
            mutation.node.semanticHash
          );
        }
        nodes.set(mutation.node.id, mutation.node);
        return true;
      }

      case 'addEdge': {
        if (!nodes.has(mutation.edge.source)) {
          throw new IntegrityError(mutation.edge.source, mutation.edge.id);
        }
        if (!nodes.has(mutation.edge.target)) {
          throw new IntegrityError(mutation.edge.target, mutation.edge.id);
        }

        const existing = edges.get(mutation.edge.id);
        if (existing) {
          if (existing.semanticHash === mutation.edge.semanticHash) {
            return false; // Skipped - idempotent
          }
          throw new ConflictError(
            mutation.edge.id,
            existing.semanticHash,
            mutation.edge.semanticHash
          );
        }
        edges.set(mutation.edge.id, mutation.edge);
        return true;
      }

      case 'addArtifact': {
        const existing = artifacts.get(mutation.artifact.id);
        if (existing) {
          if (existing.semanticHash === mutation.artifact.semanticHash) {
            return false; // Skipped - idempotent
          }
          throw new ConflictError(
            mutation.artifact.id,
            existing.semanticHash,
            mutation.artifact.semanticHash
          );
        }
        artifacts.set(mutation.artifact.id, mutation.artifact);
        return true;
      }
    }
  }

  /**
   * Returns a snapshot of the graph with canonically ordered arrays.
   */
  toSnapshot(): GraphSnapshot {
    return {
      schemaVersion: '1.0.0',
      nodes: Array.from(this.nodes.values()).sort(compareNodes),
      edges: Array.from(this.edges.values()).sort(compareEdges),
      artifacts: Array.from(this.artifacts.values()).sort(compareArtifacts),
    };
  }

  // Query methods

  getNode(id: string): Node | undefined {
    return this.nodes.get(id);
  }

  getEdge(id: string): Edge | undefined {
    return this.edges.get(id);
  }

  getArtifact(id: string): DerivedArtifact | undefined {
    return this.artifacts.get(id);
  }

  hasNode(id: string): boolean {
    return this.nodes.has(id);
  }

  hasEdge(id: string): boolean {
    return this.edges.has(id);
  }

  hasArtifact(id: string): boolean {
    return this.artifacts.has(id);
  }

  getAllNodes(): ReadonlyArray<Node> {
    return Array.from(this.nodes.values());
  }

  getAllEdges(): ReadonlyArray<Edge> {
    return Array.from(this.edges.values());
  }

  getAllArtifacts(): ReadonlyArray<DerivedArtifact> {
    return Array.from(this.artifacts.values());
  }
}
