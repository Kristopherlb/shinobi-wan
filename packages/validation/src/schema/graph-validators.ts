import {
  NODE_TYPES,
  EDGE_TYPES,
  ARTIFACT_TYPES,
  isValidNodeId,
  isValidEdgeId,
  isValidArtifactId,
} from '@shinobi/ir';
import {
  createError,
  createResult,
  type ValidationError,
  type ValidationResult,
  type ValidatorOptions,
} from '../errors';
import { hasRequiredField, rejectUnknownFields, validateEnumField } from './field-validators';

const DEFAULT_OPTIONS: ValidatorOptions = { strict: true };

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

const SNAPSHOT_KNOWN_FIELDS = new Set(['schemaVersion', 'nodes', 'edges', 'artifacts']);

/**
 * Validates a Node object schema with enhanced error messages.
 */
export function validateNodeSchema(
  node: unknown,
  options: ValidatorOptions = DEFAULT_OPTIONS
): ValidationResult {
  const errors: ValidationError[] = [];

  if (!node || typeof node !== 'object') {
    errors.push(
      createError({
        path: '$',
        rule: 'invalid-input-type',
        message: 'Node must be an object',
        severity: 'error',
      })
    );
    return createResult(errors);
  }

  const n = node as Record<string, unknown>;

  // Required string fields
  errors.push(...hasRequiredField(n, '$.id', 'id', 'string'));
  if (typeof n.id === 'string' && !isValidNodeId(n.id)) {
    errors.push(
      createError({
        path: '$.id',
        rule: 'invalid-node-id',
        message: `Invalid node ID format: '${n.id}'. Expected format: {type}:{path}`,
        severity: 'error',
        remediation: 'Node IDs must start with a valid node type followed by colon and path',
        kernelLaw: 'KL-001',
      })
    );
  }

  errors.push(...hasRequiredField(n, '$.semanticHash', 'semanticHash', 'string'));

  errors.push(...hasRequiredField(n, '$.type', 'type', 'string'));
  if (typeof n.type === 'string') {
    errors.push(...validateEnumField(n.type, '$.type', NODE_TYPES as readonly string[]));
  }

  if (n.schemaVersion !== '1.0.0') {
    errors.push(
      createError({
        path: '$.schemaVersion',
        rule: 'invalid-enum-value',
        message: 'schemaVersion must be "1.0.0"',
        severity: 'error',
        allowedValues: ['1.0.0'],
      })
    );
  }

  errors.push(...hasRequiredField(n, '$.provenance', 'provenance', 'object'));
  errors.push(...hasRequiredField(n, '$.metadata', 'metadata', 'object'));

  // Strict mode: reject unknown fields
  if (options.strict !== false) {
    errors.push(...rejectUnknownFields(n, '$', NODE_KNOWN_FIELDS));
  }

  return createResult(errors);
}

/**
 * Validates an Edge object schema with enhanced error messages.
 */
export function validateEdgeSchema(
  edge: unknown,
  options: ValidatorOptions = DEFAULT_OPTIONS
): ValidationResult {
  const errors: ValidationError[] = [];

  if (!edge || typeof edge !== 'object') {
    errors.push(
      createError({
        path: '$',
        rule: 'invalid-input-type',
        message: 'Edge must be an object',
        severity: 'error',
      })
    );
    return createResult(errors);
  }

  const e = edge as Record<string, unknown>;

  // Required string fields
  errors.push(...hasRequiredField(e, '$.id', 'id', 'string'));
  if (typeof e.id === 'string' && !isValidEdgeId(e.id)) {
    errors.push(
      createError({
        path: '$.id',
        rule: 'invalid-edge-id',
        message: `Invalid edge ID format: '${e.id}'. Expected format: edge:{type}:{source}:{target}`,
        severity: 'error',
        remediation: 'Edge IDs must start with "edge:" followed by type, source, and target',
        kernelLaw: 'KL-001',
      })
    );
  }

  errors.push(...hasRequiredField(e, '$.semanticHash', 'semanticHash', 'string'));

  errors.push(...hasRequiredField(e, '$.type', 'type', 'string'));
  if (typeof e.type === 'string') {
    errors.push(...validateEnumField(e.type, '$.type', EDGE_TYPES as readonly string[]));
  }

  errors.push(...hasRequiredField(e, '$.source', 'source', 'string'));
  errors.push(...hasRequiredField(e, '$.target', 'target', 'string'));

  if (e.schemaVersion !== '1.0.0') {
    errors.push(
      createError({
        path: '$.schemaVersion',
        rule: 'invalid-enum-value',
        message: 'schemaVersion must be "1.0.0"',
        severity: 'error',
        allowedValues: ['1.0.0'],
      })
    );
  }

  errors.push(...hasRequiredField(e, '$.provenance', 'provenance', 'object'));
  errors.push(...hasRequiredField(e, '$.metadata', 'metadata', 'object'));

  // Strict mode: reject unknown fields
  if (options.strict !== false) {
    errors.push(...rejectUnknownFields(e, '$', EDGE_KNOWN_FIELDS));
  }

  return createResult(errors);
}

/**
 * Validates a DerivedArtifact object schema with enhanced error messages.
 */
export function validateArtifactSchema(
  artifact: unknown,
  options: ValidatorOptions = DEFAULT_OPTIONS
): ValidationResult {
  const errors: ValidationError[] = [];

  if (!artifact || typeof artifact !== 'object') {
    errors.push(
      createError({
        path: '$',
        rule: 'invalid-input-type',
        message: 'Artifact must be an object',
        severity: 'error',
      })
    );
    return createResult(errors);
  }

  const a = artifact as Record<string, unknown>;

  // Required string fields
  errors.push(...hasRequiredField(a, '$.id', 'id', 'string'));
  if (typeof a.id === 'string' && !isValidArtifactId(a.id)) {
    errors.push(
      createError({
        path: '$.id',
        rule: 'invalid-artifact-id',
        message: `Invalid artifact ID format: '${a.id}'. Expected format: artifact:{type}:{sourceNodeId}`,
        severity: 'error',
        remediation:
          'Artifact IDs must start with "artifact:" followed by type and source node ID',
        kernelLaw: 'KL-001',
      })
    );
  }

  errors.push(...hasRequiredField(a, '$.semanticHash', 'semanticHash', 'string'));

  errors.push(...hasRequiredField(a, '$.type', 'type', 'string'));
  if (typeof a.type === 'string') {
    errors.push(...validateEnumField(a.type, '$.type', ARTIFACT_TYPES as readonly string[]));
  }

  errors.push(...hasRequiredField(a, '$.sourceNodeId', 'sourceNodeId', 'string'));
  errors.push(...hasRequiredField(a, '$.content', 'content', 'object'));

  if (a.schemaVersion !== '1.0.0') {
    errors.push(
      createError({
        path: '$.schemaVersion',
        rule: 'invalid-enum-value',
        message: 'schemaVersion must be "1.0.0"',
        severity: 'error',
        allowedValues: ['1.0.0'],
      })
    );
  }

  errors.push(...hasRequiredField(a, '$.provenance', 'provenance', 'object'));

  // Strict mode: reject unknown fields
  if (options.strict !== false) {
    errors.push(...rejectUnknownFields(a, '$', ARTIFACT_KNOWN_FIELDS));
  }

  return createResult(errors);
}

/**
 * Validates a GraphSnapshot object schema with enhanced error messages.
 */
export function validateSnapshotSchema(
  snapshot: unknown,
  options: ValidatorOptions = DEFAULT_OPTIONS
): ValidationResult {
  const errors: ValidationError[] = [];

  if (!snapshot || typeof snapshot !== 'object') {
    errors.push(
      createError({
        path: '$',
        rule: 'invalid-input-type',
        message: 'Snapshot must be an object',
        severity: 'error',
      })
    );
    return createResult(errors);
  }

  const s = snapshot as Record<string, unknown>;

  // Schema version
  if (s.schemaVersion !== '1.0.0') {
    errors.push(
      createError({
        path: '$.schemaVersion',
        rule: 'invalid-enum-value',
        message: 'schemaVersion must be "1.0.0"',
        severity: 'error',
        allowedValues: ['1.0.0'],
      })
    );
  }

  // Nodes array
  if (!Array.isArray(s.nodes)) {
    errors.push(
      createError({
        path: '$.nodes',
        rule: 'missing-required-field',
        message: 'nodes must be an array',
        severity: 'error',
      })
    );
  } else {
    for (let i = 0; i < s.nodes.length; i++) {
      const nodeResult = validateNodeSchema(s.nodes[i], options);
      for (const err of nodeResult.errors) {
        const path = err.path === '$' ? `$.nodes[${i}]` : `$.nodes[${i}]${err.path.slice(1)}`;
        errors.push(
          createError({
            ...err,
            path,
          })
        );
      }
    }
  }

  // Edges array
  if (!Array.isArray(s.edges)) {
    errors.push(
      createError({
        path: '$.edges',
        rule: 'missing-required-field',
        message: 'edges must be an array',
        severity: 'error',
      })
    );
  } else {
    for (let i = 0; i < s.edges.length; i++) {
      const edgeResult = validateEdgeSchema(s.edges[i], options);
      for (const err of edgeResult.errors) {
        const path = err.path === '$' ? `$.edges[${i}]` : `$.edges[${i}]${err.path.slice(1)}`;
        errors.push(
          createError({
            ...err,
            path,
          })
        );
      }
    }
  }

  // Artifacts array
  if (!Array.isArray(s.artifacts)) {
    errors.push(
      createError({
        path: '$.artifacts',
        rule: 'missing-required-field',
        message: 'artifacts must be an array',
        severity: 'error',
      })
    );
  } else {
    for (let i = 0; i < s.artifacts.length; i++) {
      const artifactResult = validateArtifactSchema(s.artifacts[i], options);
      for (const err of artifactResult.errors) {
        const path =
          err.path === '$' ? `$.artifacts[${i}]` : `$.artifacts[${i}]${err.path.slice(1)}`;
        errors.push(
          createError({
            ...err,
            path,
          })
        );
      }
    }
  }

  // Strict mode: reject unknown fields
  if (options.strict !== false) {
    errors.push(...rejectUnknownFields(s, '$', SNAPSHOT_KNOWN_FIELDS));
  }

  return createResult(errors);
}
