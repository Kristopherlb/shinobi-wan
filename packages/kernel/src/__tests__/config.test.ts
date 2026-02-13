import { describe, it, expect } from 'vitest';
import { resolveConfig, interpolateEnvTokens } from '../config';
import { ConfigError } from '../errors';
import type { KernelConfig } from '../types';

describe('interpolateEnvTokens', () => {
  it('replaces ${env:KEY} with environment value', () => {
    const result = interpolateEnvTokens('region: ${env:AWS_REGION}', { AWS_REGION: 'us-east-1' });
    expect(result).toBe('region: us-east-1');
  });

  it('uses fallback when env key is missing', () => {
    const result = interpolateEnvTokens('${env:MISSING:default-val}', {});
    expect(result).toBe('default-val');
  });

  it('uses empty string fallback', () => {
    const result = interpolateEnvTokens('prefix-${env:OPT:}-suffix', {});
    expect(result).toBe('prefix--suffix');
  });

  it('throws ConfigError when key is missing and no fallback', () => {
    expect(() => interpolateEnvTokens('${env:MISSING}', {})).toThrow(ConfigError);
  });

  it('recursively processes objects', () => {
    const result = interpolateEnvTokens(
      { region: '${env:REGION}', nested: { zone: '${env:ZONE}' } },
      { REGION: 'us-east-1', ZONE: 'a' }
    );
    expect(result).toEqual({ region: 'us-east-1', nested: { zone: 'a' } });
  });

  it('recursively processes arrays', () => {
    const result = interpolateEnvTokens(['${env:A}', '${env:B}'], { A: '1', B: '2' });
    expect(result).toEqual(['1', '2']);
  });

  it('passes primitives through unchanged', () => {
    expect(interpolateEnvTokens(42, {})).toBe(42);
    expect(interpolateEnvTokens(true, {})).toBe(true);
    expect(interpolateEnvTokens(null, {})).toBe(null);
    expect(interpolateEnvTokens(undefined, {})).toBe(undefined);
  });

  it('handles multiple tokens in one string', () => {
    const result = interpolateEnvTokens('${env:A}-${env:B}', { A: 'x', B: 'y' });
    expect(result).toBe('x-y');
  });
});

describe('resolveConfig', () => {
  it('returns empty object when no layers are provided', () => {
    const result = resolveConfig({});
    expect(result).toEqual({});
  });

  it('merges layers in precedence order (defaults → environment → overrides)', () => {
    const config: KernelConfig = {
      layers: [
        { source: 'defaults', values: { a: 1, b: 2 } },
        { source: 'environment', values: { b: 3 } },
        { source: 'overrides', values: { c: 4 } },
      ],
    };
    const result = resolveConfig(config);
    expect(result).toEqual({ a: 1, b: 3, c: 4 });
  });

  it('deep-merges nested objects', () => {
    const config: KernelConfig = {
      layers: [
        { source: 'defaults', values: { db: { host: 'localhost', port: 5432 } } },
        { source: 'overrides', values: { db: { host: 'prod-db' } } },
      ],
    };
    const result = resolveConfig(config);
    expect(result).toEqual({ db: { host: 'prod-db', port: 5432 } });
  });

  it('interpolates env tokens after merging', () => {
    const config: KernelConfig = {
      layers: [{ source: 'defaults', values: { region: '${env:REGION}' } }],
      environment: { REGION: 'us-west-2' },
    };
    const result = resolveConfig(config);
    expect(result).toEqual({ region: 'us-west-2' });
  });

  it('returns a frozen result', () => {
    const config: KernelConfig = {
      layers: [{ source: 'defaults', values: { x: 1 } }],
    };
    const result = resolveConfig(config);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('produces deterministic output for identical inputs', () => {
    const config: KernelConfig = {
      layers: [
        { source: 'defaults', values: { a: 1, b: 2 } },
        { source: 'overrides', values: { b: 3 } },
      ],
      environment: {},
    };
    const r1 = resolveConfig(config);
    const r2 = resolveConfig(config);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});
