import { describe, it, expect } from 'vitest';
import {
  SEVERITY_LEVELS,
  createViolationId,
  isValidViolationId,
} from '../violation/index';

describe('SEVERITY_LEVELS', () => {
  it('defines standard severity levels', () => {
    expect(SEVERITY_LEVELS).toEqual(['error', 'warning', 'info']);
  });
});

describe('createViolationId', () => {
  it('produces stable ID format: violation:{ruleId}:{targetId}', () => {
    const id = createViolationId('least-privilege', 'component:api');
    expect(id).toBe('violation:least-privilege:component:api');
  });

  it('handles empty ruleId', () => {
    const id = createViolationId('', 'component:api');
    expect(id).toBe('violation::component:api');
  });

  it('handles empty targetId', () => {
    const id = createViolationId('rule-1', '');
    expect(id).toBe('violation:rule-1:');
  });
});

describe('isValidViolationId', () => {
  it('accepts valid violation IDs', () => {
    expect(isValidViolationId('violation:rule-1:component:api')).toBe(true);
    expect(isValidViolationId('violation:rule:target')).toBe(true);
  });

  it('rejects non-violation prefixes', () => {
    expect(isValidViolationId('invalid')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidViolationId('')).toBe(false);
  });

  it('accepts IDs with colons in targetId (violation:a:b:c:d)', () => {
    expect(isValidViolationId('violation:a:b:c:d')).toBe(true);
  });

  it('rejects violation: with missing parts', () => {
    expect(isValidViolationId('violation:')).toBe(false);
    expect(isValidViolationId('violation:rule')).toBe(false);
  });
});
