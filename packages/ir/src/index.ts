/**
 * @shinobi/ir - Intermediate Representation for Shinobi V3
 *
 * This package provides the core graph data model including:
 * - Node, Edge, DerivedArtifact types
 * - Graph class with copy-on-write mutations
 * - Canonical ordering and serialization
 * - Runtime validation
 */

// Types
export type {
  Node,
  NodeType,
  NodeMetadata,
  Edge,
  EdgeType,
  EdgeMetadata,
  DerivedArtifact,
  ArtifactType,
  Provenance,
  GraphSnapshot,
} from './types';

export { NODE_TYPES, EDGE_TYPES, ARTIFACT_TYPES } from './types';

// Errors
export { ValidationError, ConflictError, IntegrityError } from './errors';

// Graph
export { Graph } from './graph';
export type { GraphMutation, MutationResult, MutationError } from './graph';

// ID Generation
export {
  createNodeId,
  createEdgeId,
  createArtifactId,
  computeSemanticHash,
  isValidNodeId,
  isValidEdgeId,
  isValidArtifactId,
} from './id-generation';

// Ordering
export { compareNodes, compareEdges, compareArtifacts } from './ordering';

// Canonicalization
export { canonicalize, canonicalStringify } from './canonicalization';
export type { CanonicalValue } from './canonicalization';

// Validation
export {
  validateNode,
  validateEdge,
  validateArtifact,
  validateSnapshot,
} from './validation';
export type { ValidationResult, ValidationOptions } from './validation';

// Snapshot factory
export { createSnapshot } from './snapshot-factory';

// Runtime builders
export { createNode, createEdge } from './builders';

// Test fixtures
export { createTestNode, createTestEdge } from './test-fixtures';

// Serialization
export { serializeGraph, deserializeGraph } from './serialization';
