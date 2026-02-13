import { describe, it, expect } from 'vitest';
import { ValidationError, ConflictError, IntegrityError } from '../errors';

describe('ValidationError', () => {
  it('captures path and rule for schema validation failures', () => {
    const error = new ValidationError('$.id', 'required string');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ValidationError');
    expect(error.path).toBe('$.id');
    expect(error.rule).toBe('required string');
    expect(error.message).toContain('$.id');
    expect(error.message).toContain('required string');
  });

  it('produces actionable error messages', () => {
    const error = new ValidationError('$.metadata.properties', 'must be object');

    expect(error.message).toMatch(/metadata\.properties.*must be object/i);
  });
});

describe('ConflictError', () => {
  it('captures existing and incoming hashes for semantic conflicts', () => {
    const error = new ConflictError(
      'component:services/api',
      'abc123',
      'def456'
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ConflictError');
    expect(error.id).toBe('component:services/api');
    expect(error.existingHash).toBe('abc123');
    expect(error.incomingHash).toBe('def456');
  });

  it('produces actionable error message mentioning the conflicting ID', () => {
    const error = new ConflictError('node:foo', 'hash1', 'hash2');

    expect(error.message).toContain('node:foo');
    expect(error.message).toMatch(/conflict|different/i);
  });
});

describe('IntegrityError', () => {
  it('captures missing reference and referring entity', () => {
    const error = new IntegrityError(
      'component:missing',
      'edge:bindsTo:component:a:component:missing'
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('IntegrityError');
    expect(error.missingRef).toBe('component:missing');
    expect(error.referencedBy).toBe('edge:bindsTo:component:a:component:missing');
  });

  it('produces actionable error message for missing references', () => {
    const error = new IntegrityError('target:node', 'edge:123');

    expect(error.message).toContain('target:node');
    expect(error.message).toMatch(/missing|not found|does not exist/i);
  });
});
