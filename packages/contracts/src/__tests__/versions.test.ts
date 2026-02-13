import { describe, it, expect } from 'vitest';
import { CONTRACT_SCHEMA_VERSION, type ContractSchemaVersion } from '../versions';

describe('CONTRACT_SCHEMA_VERSION', () => {
  it('is 1.0.0', () => {
    expect(CONTRACT_SCHEMA_VERSION).toBe('1.0.0');
  });

  it('is a const type (not just string)', () => {
    // TypeScript ensures this at compile time
    const version: ContractSchemaVersion = CONTRACT_SCHEMA_VERSION;
    expect(version).toBe('1.0.0');
  });
});
