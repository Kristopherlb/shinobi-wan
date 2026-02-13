import { createHash } from 'crypto';
import { canonicalStringify } from './canonicalization';
import { NODE_TYPES, EDGE_TYPES, ARTIFACT_TYPES } from './types';
import type { NodeType, EdgeType, ArtifactType } from './types';

/**
 * Creates a stable node ID from type and canonical path.
 * Format: {type}:{canonicalPath}
 */
export function createNodeId(type: NodeType, canonicalPath: string): string {
  return `${type}:${canonicalPath}`;
}

/**
 * Creates a stable edge ID from type, source, and target.
 * Format: edge:{type}:{sourceId}:{targetId}
 */
export function createEdgeId(
  type: EdgeType,
  sourceId: string,
  targetId: string
): string {
  return `edge:${type}:${sourceId}:${targetId}`;
}

/**
 * Creates a stable artifact ID from type and source node.
 * Format: artifact:{type}:{sourceNodeId}
 */
export function createArtifactId(
  type: ArtifactType,
  sourceNodeId: string
): string {
  return `artifact:${type}:${sourceNodeId}`;
}

/**
 * Ephemeral fields to exclude from semantic hash computation.
 * These fields don't affect the semantic meaning of an entity.
 */
const EPHEMERAL_PROVENANCE_FIELDS = new Set(['lineNumber', 'derivedFrom']);
const EPHEMERAL_METADATA_FIELDS = new Set(['label']);

/**
 * Extracts the semantic projection of a value for hashing.
 * Excludes ephemeral fields that don't affect semantic meaning.
 */
function semanticProjection(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(semanticProjection);
  }

  const obj = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(obj)) {
    const val = obj[key];

    // Handle provenance field specially
    if (key === 'provenance' && typeof val === 'object' && val !== null) {
      const provenance = val as Record<string, unknown>;
      const filtered: Record<string, unknown> = {};

      for (const pKey of Object.keys(provenance)) {
        if (!EPHEMERAL_PROVENANCE_FIELDS.has(pKey)) {
          filtered[pKey] = provenance[pKey];
        }
      }

      if (Object.keys(filtered).length > 0) {
        result[key] = filtered;
      }
      continue;
    }

    // Handle metadata field specially
    if (key === 'metadata' && typeof val === 'object' && val !== null) {
      const metadata = val as Record<string, unknown>;
      const filtered: Record<string, unknown> = {};

      for (const mKey of Object.keys(metadata)) {
        if (!EPHEMERAL_METADATA_FIELDS.has(mKey)) {
          filtered[mKey] = semanticProjection(metadata[mKey]);
        }
      }

      if (Object.keys(filtered).length > 0) {
        result[key] = filtered;
      }
      continue;
    }

    // Skip schemaVersion and semanticHash (representation fields)
    if (key === 'schemaVersion' || key === 'semanticHash') {
      continue;
    }

    result[key] = semanticProjection(val);
  }

  return result;
}

/**
 * Computes a SHA-256 semantic hash of the given content.
 * Uses semantic projection to exclude ephemeral fields.
 * Returns hash prefixed with 'sha256:'.
 */
export function computeSemanticHash(content: unknown): string {
  const projection = semanticProjection(content);
  const canonical = canonicalStringify(projection);
  const hash = createHash('sha256').update(canonical).digest('hex');
  return `sha256:${hash}`;
}

/**
 * Validates a node ID format.
 */
export function isValidNodeId(id: string): boolean {
  if (!id || typeof id !== 'string') {
    return false;
  }

  const colonIndex = id.indexOf(':');
  if (colonIndex === -1) {
    return false;
  }

  const type = id.substring(0, colonIndex);
  const path = id.substring(colonIndex + 1);

  if (!path) {
    return false;
  }

  return (NODE_TYPES as readonly string[]).includes(type);
}

/**
 * Validates an edge ID format.
 */
export function isValidEdgeId(id: string): boolean {
  if (!id || typeof id !== 'string') {
    return false;
  }

  if (!id.startsWith('edge:')) {
    return false;
  }

  const rest = id.substring(5); // Remove 'edge:'
  const colonIndex = rest.indexOf(':');
  if (colonIndex === -1) {
    return false;
  }

  const type = rest.substring(0, colonIndex);
  const remainder = rest.substring(colonIndex + 1);

  if (!remainder) {
    return false;
  }

  return (EDGE_TYPES as readonly string[]).includes(type);
}

/**
 * Validates an artifact ID format.
 */
export function isValidArtifactId(id: string): boolean {
  if (!id || typeof id !== 'string') {
    return false;
  }

  if (!id.startsWith('artifact:')) {
    return false;
  }

  const rest = id.substring(9); // Remove 'artifact:'
  const colonIndex = rest.indexOf(':');
  if (colonIndex === -1) {
    return false;
  }

  const type = rest.substring(0, colonIndex);
  const remainder = rest.substring(colonIndex + 1);

  if (!remainder) {
    return false;
  }

  return (ARTIFACT_TYPES as readonly string[]).includes(type);
}
