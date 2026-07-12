import { describe, it, expect } from 'vitest';
import { parsePolicyExceptions, applyPolicyExceptions } from '../exceptions';
import type { PolicyException } from '../exceptions';
import { createViolation } from '../violation-factory';
import type { Violation } from '@shinobi/contracts';

function makeViolation(
  overrides?: Partial<{ ruleId: string; targetId: string; severity: string }>,
): Violation {
  return createViolation({
    ruleId: overrides?.ruleId ?? 'iam-no-wildcard-resource',
    ruleName: 'No Wildcard Resources',
    severity: (overrides?.severity as Violation['severity']) ?? 'error',
    target: {
      type: 'node',
      id: overrides?.targetId ?? 'component:api-handler',
    },
    message: 'test violation',
    remediation: { summary: 'fix it', autoFixable: false },
    policyPack: 'Baseline',
  });
}

const ACTIVE: PolicyException = {
  ruleId: 'iam-no-wildcard-resource',
  target: 'api-handler',
  expires: '2999-01-01',
  justification: 'legacy integration, migration tracked in EE-9',
  approvedBy: 'security-team',
};

describe('parsePolicyExceptions', () => {
  it('parses a valid record', () => {
    const { exceptions, errors } = parsePolicyExceptions([ACTIVE]);
    expect(errors).toHaveLength(0);
    expect(exceptions).toHaveLength(1);
    expect(exceptions[0].approvedBy).toBe('security-team');
  });

  it('rejects records missing required fields with stable paths', () => {
    const { exceptions, errors } = parsePolicyExceptions([
      { ruleId: 'x', target: 'y' },
    ]);
    expect(exceptions).toHaveLength(0);
    expect(errors.map((e) => e.path)).toEqual([
      '$.exceptions[0].expires',
      '$.exceptions[0].justification',
    ]);
  });

  it('rejects malformed expiry dates', () => {
    const { errors } = parsePolicyExceptions([
      { ...ACTIVE, expires: 'next-quarter' },
    ]);
    expect(errors[0].path).toBe('$.exceptions[0].expires');
  });

  it('rejects non-array input', () => {
    const { errors } = parsePolicyExceptions({ ruleId: 'x' });
    expect(errors[0].path).toBe('$.exceptions');
  });

  it('returns empty for undefined', () => {
    const { exceptions, errors } = parsePolicyExceptions(undefined);
    expect(exceptions).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });
});

describe('applyPolicyExceptions', () => {
  it('suppresses a matching violation but keeps it for audit', () => {
    const result = applyPolicyExceptions(
      [makeViolation()],
      [ACTIVE],
      'Baseline',
      '2026-07-12',
    );
    expect(result).toHaveLength(1);
    expect(result[0].suppressed).toBe(true);
    expect(result[0].severity).toBe('info');
    expect(result[0].exception?.justification).toContain('legacy integration');
  });

  it('matches service-wide exceptions with target *', () => {
    const result = applyPolicyExceptions(
      [makeViolation({ targetId: 'component:other' })],
      [{ ...ACTIVE, target: '*' }],
      'Baseline',
      '2026-07-12',
    );
    expect(result[0].suppressed).toBe(true);
  });

  it('does not suppress a different rule', () => {
    const result = applyPolicyExceptions(
      [makeViolation({ ruleId: 'sqs-dlq-missing' })],
      [ACTIVE],
      'Baseline',
      '2026-07-12',
    );
    expect(result[0].suppressed).toBeUndefined();
    expect(result[0].severity).toBe('error');
  });

  it('does not suppress a different target', () => {
    const result = applyPolicyExceptions(
      [makeViolation({ targetId: 'component:worker' })],
      [ACTIVE],
      'Baseline',
      '2026-07-12',
    );
    expect(result[0].suppressed).toBeUndefined();
  });

  it('expired exceptions do not suppress and emit an expiry violation', () => {
    const expired = { ...ACTIVE, expires: '2026-01-01' };
    const result = applyPolicyExceptions(
      [makeViolation()],
      [expired],
      'Baseline',
      '2026-07-12',
    );
    expect(result).toHaveLength(2);
    expect(result[0].suppressed).toBeUndefined();
    expect(result[0].severity).toBe('error');
    const expiry = result.find((v) => v.ruleId === 'policy-exception-expired');
    expect(expiry).toBeDefined();
    expect(expiry?.message).toContain('expired on 2026-01-01');
  });

  it('expiry boundary: an exception is active on its expiry date', () => {
    const result = applyPolicyExceptions(
      [makeViolation()],
      [{ ...ACTIVE, expires: '2026-07-12' }],
      'Baseline',
      '2026-07-12',
    );
    expect(result[0].suppressed).toBe(true);
  });

  it('is deterministic for identical inputs', () => {
    const violations = [makeViolation()];
    const a = applyPolicyExceptions(
      violations,
      [ACTIVE],
      'Baseline',
      '2026-07-12',
    );
    const b = applyPolicyExceptions(
      violations,
      [ACTIVE],
      'Baseline',
      '2026-07-12',
    );
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
