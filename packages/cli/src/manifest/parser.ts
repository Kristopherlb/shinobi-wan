import * as yaml from 'js-yaml';
import type { ServiceManifest, ManifestComponent, ManifestBinding, ManifestError, ManifestParseResult } from './types';
import { NODE_TYPES, EDGE_TYPES } from '@shinobi/ir';

const VALID_NODE_TYPES = new Set<string>(NODE_TYPES);
const VALID_EDGE_TYPES = new Set<string>(EDGE_TYPES);

/**
 * Parses a YAML manifest string into a validated ServiceManifest.
 *
 * Returns either a successful result with the manifest,
 * or a failure result with structured validation errors.
 */
export function parseManifest(yamlContent: string): ManifestParseResult {
  let raw: unknown;
  try {
    raw = yaml.load(yamlContent);
  } catch (e) {
    return {
      ok: false,
      errors: [{ path: '$', message: `YAML parse error: ${(e as Error).message}` }],
    };
  }

  if (raw === null || raw === undefined || typeof raw !== 'object') {
    return {
      ok: false,
      errors: [{ path: '$', message: 'Manifest must be a YAML object' }],
    };
  }

  const obj = raw as Record<string, unknown>;
  const errors: ManifestError[] = [];

  // Validate top-level fields
  if (typeof obj['service'] !== 'string' || obj['service'].length === 0) {
    errors.push({ path: '$.service', message: 'service is required and must be a non-empty string' });
  }

  if (!Array.isArray(obj['components'])) {
    errors.push({ path: '$.components', message: 'components is required and must be an array' });
  }

  if (!Array.isArray(obj['bindings'])) {
    errors.push({ path: '$.bindings', message: 'bindings is required and must be an array' });
  }

  if (obj['policyPack'] !== undefined && typeof obj['policyPack'] !== 'string') {
    errors.push({ path: '$.policyPack', message: 'policyPack must be a string if provided' });
  }

  // If top-level structure is invalid, return early
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const components = validateComponents(obj['components'] as unknown[]);
  const bindings = validateBindings(obj['bindings'] as unknown[]);

  errors.push(...components.errors, ...bindings.errors);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // Cross-reference: all binding sources/targets must reference declared component IDs
  const componentIds = new Set(components.items.map((c) => c.id));
  for (let i = 0; i < bindings.items.length; i++) {
    const b = bindings.items[i];
    if (!componentIds.has(b.source)) {
      errors.push({
        path: `$.bindings[${i}].source`,
        message: `binding source '${b.source}' does not match any component id`,
      });
    }
    if (!componentIds.has(b.target)) {
      errors.push({
        path: `$.bindings[${i}].target`,
        message: `binding target '${b.target}' does not match any component id`,
      });
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const manifest: ServiceManifest = {
    service: obj['service'] as string,
    components: components.items,
    bindings: bindings.items,
    ...(typeof obj['policyPack'] === 'string' ? { policyPack: obj['policyPack'] } : {}),
  };

  return { ok: true, manifest };
}

function validateComponents(raw: unknown[]): { items: ManifestComponent[]; errors: ManifestError[] } {
  const items: ManifestComponent[] = [];
  const errors: ManifestError[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];
    const path = `$.components[${i}]`;

    if (typeof entry !== 'object' || entry === null) {
      errors.push({ path, message: 'component entry must be an object' });
      continue;
    }

    const c = entry as Record<string, unknown>;

    if (typeof c['id'] !== 'string' || c['id'].length === 0) {
      errors.push({ path: `${path}.id`, message: 'id is required and must be a non-empty string' });
      continue;
    }

    if (seenIds.has(c['id'] as string)) {
      errors.push({ path: `${path}.id`, message: `duplicate component id '${c['id']}'` });
      continue;
    }
    seenIds.add(c['id'] as string);

    if (typeof c['type'] !== 'string' || !VALID_NODE_TYPES.has(c['type'])) {
      errors.push({
        path: `${path}.type`,
        message: `type must be one of: ${NODE_TYPES.join(', ')}`,
      });
      continue;
    }

    if (typeof c['platform'] !== 'string' || c['platform'].length === 0) {
      errors.push({ path: `${path}.platform`, message: 'platform is required and must be a non-empty string' });
      continue;
    }

    const config = c['config'] !== undefined && typeof c['config'] === 'object' && c['config'] !== null
      ? (c['config'] as Record<string, unknown>)
      : undefined;

    items.push({
      id: c['id'] as string,
      type: c['type'] as ManifestComponent['type'],
      platform: c['platform'] as string,
      ...(config !== undefined ? { config } : {}),
    });
  }

  return { items, errors };
}

function validateBindings(raw: unknown[]): { items: ManifestBinding[]; errors: ManifestError[] } {
  const items: ManifestBinding[] = [];
  const errors: ManifestError[] = [];

  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];
    const path = `$.bindings[${i}]`;

    if (typeof entry !== 'object' || entry === null) {
      errors.push({ path, message: 'binding entry must be an object' });
      continue;
    }

    const b = entry as Record<string, unknown>;

    if (typeof b['source'] !== 'string' || b['source'].length === 0) {
      errors.push({ path: `${path}.source`, message: 'source is required and must be a non-empty string' });
      continue;
    }

    if (typeof b['target'] !== 'string' || b['target'].length === 0) {
      errors.push({ path: `${path}.target`, message: 'target is required and must be a non-empty string' });
      continue;
    }

    if (typeof b['type'] !== 'string' || !VALID_EDGE_TYPES.has(b['type'])) {
      errors.push({
        path: `${path}.type`,
        message: `type must be one of: ${EDGE_TYPES.join(', ')}`,
      });
      continue;
    }

    if (typeof b['config'] !== 'object' || b['config'] === null) {
      errors.push({ path: `${path}.config`, message: 'config is required and must be an object' });
      continue;
    }

    const config = b['config'] as Record<string, unknown>;

    if (typeof config['resourceType'] !== 'string' || config['resourceType'].length === 0) {
      errors.push({ path: `${path}.config.resourceType`, message: 'resourceType is required' });
      continue;
    }

    items.push({
      source: b['source'] as string,
      target: b['target'] as string,
      type: b['type'] as ManifestBinding['type'],
      config: config as unknown as ManifestBinding['config'],
    });
  }

  return { items, errors };
}
