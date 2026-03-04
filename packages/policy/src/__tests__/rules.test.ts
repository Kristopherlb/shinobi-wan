import { describe, it, expect } from 'vitest';
import { RULE_CATALOG, getRuleById } from '../rules';
import { SEVERITY_MAP, SUPPORTED_PACKS } from '../severity-map';

describe('RULE_CATALOG', () => {
  it('contains at least 15 rules', () => {
    expect(RULE_CATALOG.length).toBeGreaterThanOrEqual(15);
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
    expect(ids).toContain('sqs-dlq-missing');
    expect(ids).toContain('lambda-timeout-excessive');
    expect(ids).toContain('telemetry-tracing-disabled');
    expect(ids).toContain('cloudfront-ssl-protocol-weak');
    expect(ids).toContain('waf-not-attached');
    expect(ids).toContain('stepfunctions-logging-disabled');
    expect(ids).toContain('eventbridge-retry-missing');
    expect(ids).toContain('s3-public-access-not-blocked');
    expect(ids).toContain('eks-endpoint-public-access');
    expect(ids).toContain('eks-logging-disabled');
    expect(ids).toContain('sfn-max-recursion');
    expect(ids).toContain('secrets-rotation-disabled');
    expect(ids).toContain('kms-key-rotation-disabled');
    expect(ids).toContain('elasticache-encryption-disabled');
    expect(ids).toContain('elasticache-auth-disabled');
    expect(ids).toContain('budget-threshold-missing');
    expect(ids).toContain('bedrock-guardrails-disabled');
    expect(ids).toContain('sagemaker-vpc-disabled');
    expect(ids).toContain('opensearch-encryption-disabled');
    expect(ids).toContain('opensearch-public-access');
    expect(ids).toContain('firehose-encryption-disabled');
    expect(ids).toContain('rds-encryption-disabled');
    expect(ids).toContain('rds-public-access');
    expect(ids).toContain('cloudtrail-log-validation-disabled');
    expect(ids).toContain('guardduty-not-enabled');
    expect(ids).toContain('glue-job-security-config-missing');
    expect(ids).toContain('athena-workgroup-encryption-disabled');
    expect(ids).toContain('athena-workgroup-bytes-limit-missing');
    expect(ids).toContain('sagemaker-pipeline-parallelism-missing');
    expect(ids).toContain('msk-encryption-in-transit-disabled');
    expect(ids).toContain('msk-authentication-disabled');
    expect(ids).toContain('transit-gateway-auto-accept-enabled');
    expect(ids).toContain('network-firewall-logging-disabled');
    expect(ids).toContain('route53-health-check-missing');
    expect(ids).toContain('eks-gpu-spot-capacity');
    expect(ids).toContain('eks-addon-version-unset');
  });
});

describe('RULE_CATALOG ↔ SEVERITY_MAP consistency', () => {
  const catalogIds = RULE_CATALOG.map((r) => r.ruleId).sort();

  it.each([...SUPPORTED_PACKS])('every catalog rule has a severity in %s', (pack) => {
    const mapIds = Object.keys(SEVERITY_MAP[pack]).sort();
    for (const ruleId of catalogIds) {
      expect(mapIds, `Rule "${ruleId}" missing from SEVERITY_MAP["${pack}"]`).toContain(ruleId);
    }
  });

  it.each([...SUPPORTED_PACKS])('every %s severity entry maps to a catalog rule', (pack) => {
    const mapIds = Object.keys(SEVERITY_MAP[pack]).sort();
    for (const ruleId of mapIds) {
      expect(catalogIds, `SEVERITY_MAP["${pack}"] has orphan rule "${ruleId}"`).toContain(ruleId);
    }
  });

  it('all packs have the same rule set', () => {
    const packKeys = SUPPORTED_PACKS.map((p) => Object.keys(SEVERITY_MAP[p]).sort());
    for (let i = 1; i < packKeys.length; i++) {
      expect(packKeys[i]).toEqual(packKeys[0]);
    }
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
