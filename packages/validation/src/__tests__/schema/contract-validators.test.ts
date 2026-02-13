import { describe, it, expect } from 'vitest';
import {
  validateCapabilityIdFormat,
  validateCapabilityContractSchema,
  validateIntentSchema,
  validateViolationSchema,
} from '../../schema/contract-validators';

describe('contract-validators', () => {
  describe('validateCapabilityIdFormat', () => {
    it('accepts valid capability ID', () => {
      const result = validateCapabilityIdFormat('aws:sqs-queue@1.0.0', '$.id');
      expect(result).toEqual([]);
    });

    it('accepts capability ID with numbers', () => {
      const result = validateCapabilityIdFormat('core2:http-endpoint3@2.1.0', '$.id');
      expect(result).toEqual([]);
    });

    it('rejects capability ID without namespace', () => {
      const result = validateCapabilityIdFormat('sqs-queue@1.0.0', '$.id');
      expect(result).toHaveLength(1);
      expect(result[0].rule).toBe('invalid-capability-id');
    });

    it('rejects capability ID without version', () => {
      const result = validateCapabilityIdFormat('aws:sqs-queue', '$.id');
      expect(result).toHaveLength(1);
      expect(result[0].rule).toBe('invalid-capability-id');
    });

    it('rejects capability ID with uppercase', () => {
      const result = validateCapabilityIdFormat('AWS:sqs-queue@1.0.0', '$.id');
      expect(result).toHaveLength(1);
      expect(result[0].rule).toBe('invalid-capability-id');
    });

    it('rejects capability ID with invalid version', () => {
      const result = validateCapabilityIdFormat('aws:sqs@v1', '$.id');
      expect(result).toHaveLength(1);
      expect(result[0].rule).toBe('invalid-capability-id');
    });

    it('provides remediation guidance', () => {
      const result = validateCapabilityIdFormat('invalid', '$.id');
      expect(result[0].remediation).toBeDefined();
    });
  });

  describe('validateCapabilityContractSchema', () => {
    const validContract = {
      id: 'aws:sqs-queue@1.0.0',
      schemaVersion: '1.0.0',
      description: 'SQS queue capability',
      dataShape: { fields: {} },
      actions: ['read', 'write'],
    };

    it('validates a correct capability contract', () => {
      const result = validateCapabilityContractSchema(validContract);
      expect(result.valid).toBe(true);
    });

    it('rejects non-object input', () => {
      const result = validateCapabilityContractSchema(null);
      expect(result.valid).toBe(false);
    });

    it('rejects invalid id format', () => {
      const result = validateCapabilityContractSchema({ ...validContract, id: 'invalid' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === 'invalid-capability-id')).toBe(true);
    });

    it('rejects missing description', () => {
      const result = validateCapabilityContractSchema({ ...validContract, description: undefined });
      expect(result.valid).toBe(false);
    });

    it('rejects missing dataShape', () => {
      const result = validateCapabilityContractSchema({ ...validContract, dataShape: undefined });
      expect(result.valid).toBe(false);
    });

    it('rejects missing actions', () => {
      const result = validateCapabilityContractSchema({ ...validContract, actions: undefined });
      expect(result.valid).toBe(false);
    });

    it('rejects empty actions array', () => {
      const result = validateCapabilityContractSchema({ ...validContract, actions: [] });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === 'empty-array')).toBe(true);
    });

    it('rejects invalid action value', () => {
      const result = validateCapabilityContractSchema({
        ...validContract,
        actions: ['read', 'invalid'],
      });
      expect(result.valid).toBe(false);
    });

    it('rejects invalid schemaVersion', () => {
      const result = validateCapabilityContractSchema({
        ...validContract,
        schemaVersion: '2.0.0',
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('validateIntentSchema', () => {
    const validIamIntent = {
      type: 'iam',
      schemaVersion: '1.0.0',
      sourceEdgeId: 'edge:binding:a:b',
      principal: { nodeRef: 'node:a', role: 'function' },
      resource: { nodeRef: 'node:b', resourceType: 'queue', scope: 'specific' },
      actions: [{ level: 'read', action: 'receiveMessage' }],
    };

    const validNetworkIntent = {
      type: 'network',
      schemaVersion: '1.0.0',
      sourceEdgeId: 'edge:binding:a:b',
      source: { nodeRef: 'node:a', port: 443 },
      target: { nodeRef: 'node:b', port: 80 },
      protocol: 'tcp',
    };

    it('validates a correct IAM intent', () => {
      const result = validateIntentSchema(validIamIntent);
      expect(result.valid).toBe(true);
    });

    it('validates a correct network intent', () => {
      const result = validateIntentSchema(validNetworkIntent);
      expect(result.valid).toBe(true);
    });

    it('rejects non-object input', () => {
      const result = validateIntentSchema(null);
      expect(result.valid).toBe(false);
    });

    it('rejects missing type', () => {
      const result = validateIntentSchema({ ...validIamIntent, type: undefined });
      expect(result.valid).toBe(false);
    });

    it('rejects invalid type', () => {
      const result = validateIntentSchema({ ...validIamIntent, type: 'invalid' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === 'invalid-enum-value')).toBe(true);
    });

    it('rejects missing sourceEdgeId', () => {
      const result = validateIntentSchema({ ...validIamIntent, sourceEdgeId: undefined });
      expect(result.valid).toBe(false);
    });

    it('rejects invalid schemaVersion', () => {
      const result = validateIntentSchema({ ...validIamIntent, schemaVersion: '2.0.0' });
      expect(result.valid).toBe(false);
    });

    it('validates config intent', () => {
      const result = validateIntentSchema({
        type: 'config',
        schemaVersion: '1.0.0',
        sourceEdgeId: 'edge:binding:a:b',
        key: 'QUEUE_URL',
        valueSource: { type: 'nodeAttribute', nodeRef: 'node:b', attribute: 'url' },
      });
      expect(result.valid).toBe(true);
    });

    it('validates telemetry intent', () => {
      const result = validateIntentSchema({
        type: 'telemetry',
        schemaVersion: '1.0.0',
        sourceEdgeId: 'edge:binding:a:b',
        config: { enabled: true },
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('validateViolationSchema', () => {
    const validViolation = {
      id: 'violation:least-privilege:node:test',
      schemaVersion: '1.0.0',
      ruleId: 'least-privilege',
      ruleName: 'Least Privilege',
      severity: 'error',
      target: { type: 'node', id: 'node:test' },
      message: 'Wildcard resource access detected',
      remediation: { summary: 'Use specific resource', autoFixable: false },
      policyPack: 'baseline',
    };

    it('validates a correct violation', () => {
      const result = validateViolationSchema(validViolation);
      expect(result.valid).toBe(true);
    });

    it('rejects non-object input', () => {
      const result = validateViolationSchema(null);
      expect(result.valid).toBe(false);
    });

    it('rejects invalid violation id format', () => {
      const result = validateViolationSchema({ ...validViolation, id: 'not-a-violation' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === 'invalid-violation-id')).toBe(true);
    });

    it('rejects missing ruleId', () => {
      const result = validateViolationSchema({ ...validViolation, ruleId: undefined });
      expect(result.valid).toBe(false);
    });

    it('rejects missing ruleName', () => {
      const result = validateViolationSchema({ ...validViolation, ruleName: undefined });
      expect(result.valid).toBe(false);
    });

    it('rejects invalid severity', () => {
      const result = validateViolationSchema({ ...validViolation, severity: 'critical' });
      expect(result.valid).toBe(false);
    });

    it('rejects missing target', () => {
      const result = validateViolationSchema({ ...validViolation, target: undefined });
      expect(result.valid).toBe(false);
    });

    it('rejects missing message', () => {
      const result = validateViolationSchema({ ...validViolation, message: undefined });
      expect(result.valid).toBe(false);
    });

    it('rejects missing remediation', () => {
      const result = validateViolationSchema({ ...validViolation, remediation: undefined });
      expect(result.valid).toBe(false);
    });

    it('rejects missing policyPack', () => {
      const result = validateViolationSchema({ ...validViolation, policyPack: undefined });
      expect(result.valid).toBe(false);
    });

    it('validates target with path', () => {
      const result = validateViolationSchema({
        ...validViolation,
        target: { type: 'node', id: 'node:test', path: '$.resource.scope' },
      });
      expect(result.valid).toBe(true);
    });
  });
});
