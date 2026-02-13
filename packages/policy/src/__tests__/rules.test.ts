import { describe, it, expect } from 'vitest';
import { RULE_CATALOG, getRuleById } from '../rules';

describe('RULE_CATALOG', () => {
  it('contains exactly 4 rules', () => {
    expect(RULE_CATALOG).toHaveLength(4);
  });

  it('has no duplicate ruleIds', () => {
    const ids = RULE_CATALOG.map((r) => r.ruleId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every rule has non-empty required fields', () => {
    for (const rule of RULE_CATALOG) {
      expect(rule.ruleId.length).toBeGreaterThan(0);
      expect(rule.ruleName.length).toBeGreaterThan(0);
      expect(rule.description.length).toBeGreaterThan(0);
      expect(rule.remediation.summary.length).toBeGreaterThan(0);
      expect(typeof rule.remediation.autoFixable).toBe('boolean');
    }
  });

  it('contains expected rule IDs', () => {
    const ids = RULE_CATALOG.map((r) => r.ruleId);
    expect(ids).toContain('iam-no-wildcard-resource');
    expect(ids).toContain('iam-admin-access-review');
    expect(ids).toContain('iam-missing-conditions');
    expect(ids).toContain('network-broad-protocol');
  });
});

describe('getRuleById', () => {
  it('returns the correct rule for a known ID', () => {
    const rule = getRuleById('iam-no-wildcard-resource');
    expect(rule).toBeDefined();
    expect(rule?.ruleName).toBe('No Wildcard Resources');
  });

  it('returns undefined for an unknown ID', () => {
    expect(getRuleById('nonexistent-rule')).toBeUndefined();
  });
});
