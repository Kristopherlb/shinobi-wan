import { describe, it, expect } from 'vitest';
import {
  SEVERITY_LEVELS,
  type Severity,
  type Violation,
  type ViolationTarget,
  type RemediationHint,
  createViolationId,
  isValidViolationId,
} from '../violation/index';
import { CONTRACT_SCHEMA_VERSION } from '../versions';

describe('Severity', () => {
  it('defines standard severity levels', () => {
    expect(SEVERITY_LEVELS).toEqual(['error', 'warning', 'info']);
  });

  it('all levels are valid Severity type', () => {
    const levels: Severity[] = ['error', 'warning', 'info'];
    levels.forEach((level) => {
      expect(SEVERITY_LEVELS).toContain(level);
    });
  });
});

describe('Violation', () => {
  it('has required fields: id, schemaVersion, ruleId, ruleName, severity, target, message, remediation, policyPack', () => {
    const violation: Violation = {
      id: 'violation:no-wildcard-iam:component:api',
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      ruleId: 'no-wildcard-iam',
      ruleName: 'No Wildcard IAM Resources',
      severity: 'error',
      target: {
        type: 'node',
        id: 'component:api',
      },
      message: 'IAM policy uses wildcard resource which violates least-privilege',
      remediation: {
        summary: 'Replace * with specific resource ARN pattern',
        autoFixable: false,
      },
      policyPack: 'fedramp-moderate',
    };

    expect(violation.id).toContain('violation:');
    expect(violation.schemaVersion).toBe('1.0.0');
    expect(violation.severity).toBe('error');
    expect(violation.policyPack).toBe('fedramp-moderate');
  });

  it('uses stable ID format: violation:{ruleId}:{targetId}', () => {
    const id = createViolationId('least-privilege', 'component:api');
    expect(id).toBe('violation:least-privilege:component:api');
  });

  it('validates violation ID format', () => {
    expect(isValidViolationId('violation:rule-1:component:api')).toBe(true);
    expect(isValidViolationId('violation:rule:target')).toBe(true);
    expect(isValidViolationId('invalid')).toBe(false);
    expect(isValidViolationId('')).toBe(false);
  });
});

describe('ViolationTarget', () => {
  it('can target nodes', () => {
    const target: ViolationTarget = {
      type: 'node',
      id: 'component:api',
    };
    expect(target.type).toBe('node');
  });

  it('can target edges', () => {
    const target: ViolationTarget = {
      type: 'edge',
      id: 'edge:bindsTo:component:a:capability:b',
    };
    expect(target.type).toBe('edge');
  });

  it('can target artifacts', () => {
    const target: ViolationTarget = {
      type: 'artifact',
      id: 'artifact:iam-policy:component:api',
    };
    expect(target.type).toBe('artifact');
  });

  it('supports optional path for nested violations', () => {
    const target: ViolationTarget = {
      type: 'artifact',
      id: 'artifact:iam-policy:component:api',
      path: '$.statements[0].resource',
    };
    expect(target.path).toBe('$.statements[0].resource');
  });
});

describe('RemediationHint', () => {
  it('has required summary and autoFixable fields', () => {
    const hint: RemediationHint = {
      summary: 'Add explicit resource scoping',
      autoFixable: false,
    };
    expect(hint.summary).toBeTruthy();
    expect(hint.autoFixable).toBe(false);
  });

  it('supports optional steps', () => {
    const hint: RemediationHint = {
      summary: 'Fix IAM policy',
      steps: [
        'Identify the specific resources needed',
        'Replace wildcard with resource list',
        'Re-run policy validation',
      ],
      autoFixable: false,
    };
    expect(hint.steps).toHaveLength(3);
  });

  it('supports optional documentation URL', () => {
    const hint: RemediationHint = {
      summary: 'Add network segmentation',
      documentationUrl: 'https://docs.shinobi.dev/security/network-rules',
      autoFixable: true,
    };
    expect(hint.documentationUrl).toContain('https://');
  });
});
