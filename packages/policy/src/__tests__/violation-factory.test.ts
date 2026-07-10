import { describe, it, expect } from 'vitest';
import { createViolation } from '../violation-factory';
import { isValidViolationId } from '@shinobi/contracts';

describe('createViolation', () => {
  const validOpts = {
    ruleId: 'iam-no-wildcard-resource',
    ruleName: 'No Wildcard Resources',
    severity: 'error' as const,
    target: { type: 'edge' as const, id: 'edge:bindsTo:a:b' },
    message: 'Wildcard resource detected',
    remediation: {
      summary: 'Use specific scope',
      autoFixable: false,
    },
    policyPack: 'Baseline',
  };

  it('creates a violation with correct ID format', () => {
    const v = createViolation(validOpts);
    expect(v.id).toBe('violation:iam-no-wildcard-resource:edge:bindsTo:a:b');
    expect(isValidViolationId(v.id)).toBe(true);
  });

  it('sets schemaVersion to 1.0.0', () => {
    const v = createViolation(validOpts);
    expect(v.schemaVersion).toBe('1.0.0');
  });

  it('carries through all fields', () => {
    const v = createViolation(validOpts);
    expect(v.ruleId).toBe(validOpts.ruleId);
    expect(v.ruleName).toBe(validOpts.ruleName);
    expect(v.severity).toBe('error');
    expect(v.target).toEqual(validOpts.target);
    expect(v.message).toBe(validOpts.message);
    expect(v.remediation).toEqual(validOpts.remediation);
    expect(v.policyPack).toBe('Baseline');
  });

  it('returns a deeply frozen object', () => {
    const v = createViolation(validOpts);
    expect(Object.isFrozen(v)).toBe(true);
    expect(Object.isFrozen(v.target)).toBe(true);
    expect(Object.isFrozen(v.remediation)).toBe(true);
  });

  it('produces distinct IDs for different targets', () => {
    const v1 = createViolation(validOpts);
    const v2 = createViolation({
      ...validOpts,
      target: { type: 'edge' as const, id: 'edge:bindsTo:x:y' },
    });
    expect(v1.id).not.toBe(v2.id);
  });
});
