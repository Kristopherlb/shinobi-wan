import { ValidationError } from './errors';
import { NODE_TYPES, EDGE_TYPES, ARTIFACT_TYPES } from './types';
import { isValidNodeId, isValidEdgeId, isValidArtifactId } from './id-generation';

/**
 * Result of a validation operation.
 */
export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: ReadonlyArray<ValidationError>;
}

/**
 * Validation options.
 */
export interface ValidationOptions {
  /** Reject unknown fields (default: true) */
  strict?: boolean;
}

const DEFAULT_OPTIONS: ValidationOptions = { strict: true };

// Known fields for strict mode validation
const NODE_KNOWN_FIELDS = new Set([
  'id',
  'semanticHash',
  'type',
  'provenance',
  'metadata',
  'schemaVersion',
]);

const EDGE_KNOWN_FIELDS = new Set([
  'id',
  'semanticHash',
  'type',
  'source',
  'target',
  'provenance',
  'metadata',
  'schemaVersion',
]);

const ARTIFACT_KNOWN_FIELDS = new Set([
  'id',
  'semanticHash',
  'type',
  'sourceNodeId',
  'content',
  'provenance',
  'schemaVersion',
]);

const SNAPSHOT_KNOWN_FIELDS = new Set([
  'schemaVersion',
  'nodes',
  'edges',
  'artifacts',
]);

/**
 * Validates a Node object.
 */
export function validateNode(
  node: unknown,
  options: ValidationOptions = DEFAULT_OPTIONS
): ValidationResult {
  const errors: ValidationError[] = [];

  if (!node || typeof node !== 'object') {
    errors.push(new ValidationError('$', 'must be object'));
    return { valid: false, errors };
  }

  const n = node as Record<string, unknown>;

  // Required string fields
  if (typeof n.id !== 'string') {
    errors.push(new ValidationError('$.id', 'required string'));
  } else if (!isValidNodeId(n.id)) {
    errors.push(new ValidationError('$.id', 'invalid node ID format'));
  }

  if (typeof n.semanticHash !== 'string') {
    errors.push(new ValidationError('$.semanticHash', 'required string'));
  }

  if (typeof n.type !== 'string' || !(NODE_TYPES as readonly string[]).includes(n.type)) {
    errors.push(new ValidationError('$.type', `must be one of: ${NODE_TYPES.join(', ')}`));
  }

  if (n.schemaVersion !== '1.0.0') {
    errors.push(new ValidationError('$.schemaVersion', 'must be "1.0.0"'));
  }

  if (!n.provenance || typeof n.provenance !== 'object') {
    errors.push(new ValidationError('$.provenance', 'required object'));
  }

  if (!n.metadata || typeof n.metadata !== 'object') {
    errors.push(new ValidationError('$.metadata', 'required object'));
  }

  // Strict mode: reject unknown fields
  if (options.strict !== false) {
    for (const key of Object.keys(n)) {
      if (!NODE_KNOWN_FIELDS.has(key)) {
        errors.push(new ValidationError(`$.${key}`, 'unknown field'));
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates an Edge object.
 */
export function validateEdge(
  edge: unknown,
  options: ValidationOptions = DEFAULT_OPTIONS
): ValidationResult {
  const errors: ValidationError[] = [];

  if (!edge || typeof edge !== 'object') {
    errors.push(new ValidationError('$', 'must be object'));
    return { valid: false, errors };
  }

  const e = edge as Record<string, unknown>;

  // Required string fields
  if (typeof e.id !== 'string') {
    errors.push(new ValidationError('$.id', 'required string'));
  } else if (!isValidEdgeId(e.id)) {
    errors.push(new ValidationError('$.id', 'invalid edge ID format'));
  }

  if (typeof e.semanticHash !== 'string') {
    errors.push(new ValidationError('$.semanticHash', 'required string'));
  }

  if (typeof e.type !== 'string' || !(EDGE_TYPES as readonly string[]).includes(e.type)) {
    errors.push(new ValidationError('$.type', `must be one of: ${EDGE_TYPES.join(', ')}`));
  }

  if (typeof e.source !== 'string') {
    errors.push(new ValidationError('$.source', 'required string'));
  }

  if (typeof e.target !== 'string') {
    errors.push(new ValidationError('$.target', 'required string'));
  }

  if (e.schemaVersion !== '1.0.0') {
    errors.push(new ValidationError('$.schemaVersion', 'must be "1.0.0"'));
  }

  if (!e.provenance || typeof e.provenance !== 'object') {
    errors.push(new ValidationError('$.provenance', 'required object'));
  }

  if (!e.metadata || typeof e.metadata !== 'object') {
    errors.push(new ValidationError('$.metadata', 'required object'));
  }

  // Strict mode: reject unknown fields
  if (options.strict !== false) {
    for (const key of Object.keys(e)) {
      if (!EDGE_KNOWN_FIELDS.has(key)) {
        errors.push(new ValidationError(`$.${key}`, 'unknown field'));
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates a DerivedArtifact object.
 */
export function validateArtifact(
  artifact: unknown,
  options: ValidationOptions = DEFAULT_OPTIONS
): ValidationResult {
  const errors: ValidationError[] = [];

  if (!artifact || typeof artifact !== 'object') {
    errors.push(new ValidationError('$', 'must be object'));
    return { valid: false, errors };
  }

  const a = artifact as Record<string, unknown>;

  // Required string fields
  if (typeof a.id !== 'string') {
    errors.push(new ValidationError('$.id', 'required string'));
  } else if (!isValidArtifactId(a.id)) {
    errors.push(new ValidationError('$.id', 'invalid artifact ID format'));
  }

  if (typeof a.semanticHash !== 'string') {
    errors.push(new ValidationError('$.semanticHash', 'required string'));
  }

  if (typeof a.type !== 'string' || !(ARTIFACT_TYPES as readonly string[]).includes(a.type)) {
    errors.push(new ValidationError('$.type', `must be one of: ${ARTIFACT_TYPES.join(', ')}`));
  }

  if (typeof a.sourceNodeId !== 'string') {
    errors.push(new ValidationError('$.sourceNodeId', 'required string'));
  }

  if (a.content === undefined || a.content === null || typeof a.content !== 'object') {
    errors.push(new ValidationError('$.content', 'required object'));
  }

  if (a.schemaVersion !== '1.0.0') {
    errors.push(new ValidationError('$.schemaVersion', 'must be "1.0.0"'));
  }

  if (!a.provenance || typeof a.provenance !== 'object') {
    errors.push(new ValidationError('$.provenance', 'required object'));
  }

  // Strict mode: reject unknown fields
  if (options.strict !== false) {
    for (const key of Object.keys(a)) {
      if (!ARTIFACT_KNOWN_FIELDS.has(key)) {
        errors.push(new ValidationError(`$.${key}`, 'unknown field'));
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates a GraphSnapshot object.
 */
export function validateSnapshot(
  snapshot: unknown,
  options: ValidationOptions = DEFAULT_OPTIONS
): ValidationResult {
  const errors: ValidationError[] = [];

  if (!snapshot || typeof snapshot !== 'object') {
    errors.push(new ValidationError('$', 'must be object'));
    return { valid: false, errors };
  }

  const s = snapshot as Record<string, unknown>;

  // Required fields
  if (s.schemaVersion !== '1.0.0') {
    errors.push(new ValidationError('$.schemaVersion', 'must be "1.0.0"'));
  }

  if (!Array.isArray(s.nodes)) {
    errors.push(new ValidationError('$.nodes', 'required array'));
  } else {
    // Validate each node
    for (let i = 0; i < s.nodes.length; i++) {
      const nodeResult = validateNode(s.nodes[i], options);
      for (const err of nodeResult.errors) {
        errors.push(new ValidationError(`$.nodes[${i}]${err.path.slice(1)}`, err.rule));
      }
    }
  }

  if (!Array.isArray(s.edges)) {
    errors.push(new ValidationError('$.edges', 'required array'));
  } else {
    // Validate each edge
    for (let i = 0; i < s.edges.length; i++) {
      const edgeResult = validateEdge(s.edges[i], options);
      for (const err of edgeResult.errors) {
        errors.push(new ValidationError(`$.edges[${i}]${err.path.slice(1)}`, err.rule));
      }
    }
  }

  if (!Array.isArray(s.artifacts)) {
    errors.push(new ValidationError('$.artifacts', 'required array'));
  } else {
    // Validate each artifact
    for (let i = 0; i < s.artifacts.length; i++) {
      const artifactResult = validateArtifact(s.artifacts[i], options);
      for (const err of artifactResult.errors) {
        errors.push(new ValidationError(`$.artifacts[${i}]${err.path.slice(1)}`, err.rule));
      }
    }
  }

  // Strict mode: reject unknown fields
  if (options.strict !== false) {
    for (const key of Object.keys(s)) {
      if (!SNAPSHOT_KNOWN_FIELDS.has(key)) {
        errors.push(new ValidationError(`$.${key}`, 'unknown field'));
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
