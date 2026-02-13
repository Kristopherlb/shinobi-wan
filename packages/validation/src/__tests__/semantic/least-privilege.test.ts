import { describe, it, expect } from 'vitest';
import {
  validateLeastPrivilege,
  detectWildcardResources,
  WILDCARD_PATTERNS,
} from '../../semantic/least-privilege';

describe('least-privilege', () => {
  describe('WILDCARD_PATTERNS', () => {
    it('matches standalone asterisk', () => {
      expect(WILDCARD_PATTERNS.some((p) => p.test('*'))).toBe(true);
    });

    it('matches wildcard in resource path', () => {
      expect(WILDCARD_PATTERNS.some((p) => p.test('bucket/*'))).toBe(true);
      expect(WILDCARD_PATTERNS.some((p) => p.test('table/*/item'))).toBe(true);
    });

    it('matches Resource: * pattern', () => {
      expect(WILDCARD_PATTERNS.some((p) => p.test('Resource: *'))).toBe(true);
    });

    it('does not match specific resources', () => {
      expect(WILDCARD_PATTERNS.some((p) => p.test('my-specific-bucket'))).toBe(false);
      expect(WILDCARD_PATTERNS.some((p) => p.test('uploads/file.txt'))).toBe(false);
    });
  });

  describe('detectWildcardResources', () => {
    it('returns empty array for specific resource', () => {
      const intent = {
        type: 'iam',
        resource: {
          nodeRef: 'component:my-queue',
          scope: 'specific',
        },
      };

      const errors = detectWildcardResources(intent, '$');
      expect(errors).toEqual([]);
    });

    it('detects wildcard in pattern scope', () => {
      const intent = {
        type: 'iam',
        resource: {
          nodeRef: 'component:bucket',
          scope: 'pattern',
          pattern: '*',
        },
      };

      const errors = detectWildcardResources(intent, '$');
      expect(errors).toHaveLength(1);
      expect(errors[0].rule).toBe('wildcard-resource');
      expect(errors[0].kernelLaw).toBe('KL-005');
    });

    it('detects wildcard in action', () => {
      const intent = {
        type: 'iam',
        actions: [
          { level: 'read', action: '*' },
        ],
      };

      const errors = detectWildcardResources(intent, '$');
      expect(errors).toHaveLength(1);
      expect(errors[0].path).toBe('$.actions[0].action');
    });

    it('detects wildcard pattern like bucket/*', () => {
      const intent = {
        type: 'iam',
        resource: {
          pattern: 'uploads/*',
        },
      };

      const errors = detectWildcardResources(intent, '$');
      expect(errors).toHaveLength(1);
    });

    it('detects multiple wildcards', () => {
      const intent = {
        type: 'iam',
        resource: { pattern: '*' },
        actions: [
          { action: '*' },
          { action: 'sqs:*' },
        ],
      };

      const errors = detectWildcardResources(intent, '$');
      expect(errors).toHaveLength(3);
    });

    it('ignores non-string values', () => {
      const intent = {
        type: 'iam',
        count: 42,
        enabled: true,
        nested: { value: null },
      };

      const errors = detectWildcardResources(intent, '$');
      expect(errors).toEqual([]);
    });

    it('provides remediation guidance', () => {
      const intent = {
        pattern: '*',
      };

      const errors = detectWildcardResources(intent, '$');
      expect(errors[0].remediation).toContain('specific');
    });
  });

  describe('validateLeastPrivilege', () => {
    const validIamIntent = {
      type: 'iam',
      schemaVersion: '1.0.0',
      sourceEdgeId: 'edge:bindsTo:a:b',
      principal: { nodeRef: 'component:lambda', role: 'function' },
      resource: {
        nodeRef: 'component:queue',
        resourceType: 'queue',
        scope: 'specific',
      },
      actions: [{ level: 'read', action: 'receiveMessage' }],
    };

    it('validates compliant IAM intent', () => {
      const result = validateLeastPrivilege(validIamIntent);
      expect(result.valid).toBe(true);
    });

    it('rejects IAM intent with wildcard resource', () => {
      const intent = {
        ...validIamIntent,
        resource: {
          ...validIamIntent.resource,
          scope: 'pattern',
          pattern: '*',
        },
      };

      const result = validateLeastPrivilege(intent);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === 'wildcard-resource')).toBe(true);
    });

    it('rejects IAM intent with wildcard action', () => {
      const intent = {
        ...validIamIntent,
        actions: [{ level: 'admin', action: '*' }],
      };

      const result = validateLeastPrivilege(intent);
      expect(result.valid).toBe(false);
    });

    it('rejects IAM intent with partial wildcard', () => {
      const intent = {
        ...validIamIntent,
        actions: [{ level: 'read', action: 'sqs:*' }],
      };

      const result = validateLeastPrivilege(intent);
      expect(result.valid).toBe(false);
    });

    it('validates non-IAM intents without least-privilege checks', () => {
      const networkIntent = {
        type: 'network',
        schemaVersion: '1.0.0',
        sourceEdgeId: 'edge:bindsTo:a:b',
        source: { nodeRef: 'component:a', port: 443 },
        target: { nodeRef: 'component:b', port: 80 },
        protocol: 'tcp',
      };

      const result = validateLeastPrivilege(networkIntent);
      expect(result.valid).toBe(true);
    });
  });
});
