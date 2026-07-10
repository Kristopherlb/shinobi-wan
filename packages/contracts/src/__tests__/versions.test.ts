import { describe, it, expect } from 'vitest';
import { CONTRACT_SCHEMA_VERSION } from '../versions';

describe('CONTRACT_SCHEMA_VERSION', () => {
  it('is 1.0.0', () => {
    expect(CONTRACT_SCHEMA_VERSION).toBe('1.0.0');
  });
});
