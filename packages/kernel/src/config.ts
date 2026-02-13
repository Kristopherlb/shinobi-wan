import type { KernelConfig } from './types';
import { ConfigError } from './errors';
import { deepFreeze } from './freeze';

/**
 * Regex for ${env:KEY} and ${env:KEY:fallback} tokens.
 */
const ENV_TOKEN_PATTERN = /\$\{env:([^:}]+)(?::([^}]*))?\}/g;

/**
 * Interpolates ${env:KEY} and ${env:KEY:fallback} tokens in a value.
 *
 * - Strings: tokens replaced with environment values
 * - Objects/arrays: recursively processed
 * - Primitives: returned as-is
 *
 * @throws ConfigError if a referenced env key is missing and no fallback is provided
 */
export function interpolateEnvTokens(
  value: unknown,
  environment: Readonly<Record<string, string>>
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return value.replace(ENV_TOKEN_PATTERN, (_match, key: string, fallback?: string) => {
      const envValue = environment[key];
      if (envValue !== undefined) {
        return envValue;
      }
      if (fallback !== undefined) {
        return fallback;
      }
      throw new ConfigError(key, `Environment variable "${key}" is not defined and no fallback provided`);
    });
  }

  if (Array.isArray(value)) {
    return value.map((item) => interpolateEnvTokens(item, environment));
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = interpolateEnvTokens(v, environment);
    }
    return result;
  }

  return value;
}

/**
 * Resolves kernel configuration by merging layers in precedence order
 * and interpolating environment tokens (KL-007).
 *
 * Precedence: defaults → environment → overrides
 * (later layers override earlier ones at each key)
 *
 * Returns a deep-frozen resolved config object.
 */
export function resolveConfig(config: KernelConfig): Readonly<Record<string, unknown>> {
  const layers = config.layers ?? [];
  const environment = config.environment ?? {};

  // Merge layers in order: defaults → environment → overrides
  let merged: Record<string, unknown> = {};
  for (const layer of layers) {
    merged = deepMerge(merged, layer.values);
  }

  // Interpolate env tokens
  const interpolated = interpolateEnvTokens(merged, environment) as Record<string, unknown>;

  return deepFreeze(interpolated);
}

/**
 * Shallow-merge two records. Later values override earlier ones.
 * Nested objects are merged recursively; non-object values are replaced.
 */
function deepMerge(
  base: Record<string, unknown>,
  override: Readonly<Record<string, unknown>>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(override)) {
    const existing = result[key];
    if (
      existing !== null &&
      existing !== undefined &&
      typeof existing === 'object' &&
      !Array.isArray(existing) &&
      value !== null &&
      value !== undefined &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      result[key] = deepMerge(
        existing as Record<string, unknown>,
        value as Record<string, unknown>
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}
