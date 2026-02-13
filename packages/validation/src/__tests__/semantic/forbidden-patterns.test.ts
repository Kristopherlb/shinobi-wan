import { describe, it, expect } from 'vitest';
import {
  detectBackendHandles,
  detectPackBranching,
  BACKEND_HANDLE_PATTERNS,
} from '../../semantic/forbidden-patterns';

describe('forbidden-patterns', () => {
  describe('BACKEND_HANDLE_PATTERNS', () => {
    it('matches AWS ARNs', () => {
      expect(BACKEND_HANDLE_PATTERNS.some((p) => p.test('arn:aws:sqs:us-east-1:123456789012:my-queue'))).toBe(true);
      expect(BACKEND_HANDLE_PATTERNS.some((p) => p.test('arn:aws:lambda:us-west-2:123456789012:function:my-func'))).toBe(true);
      expect(BACKEND_HANDLE_PATTERNS.some((p) => p.test('arn:aws:iam::123456789012:role/my-role'))).toBe(true);
    });

    it('matches AWS resource IDs', () => {
      expect(BACKEND_HANDLE_PATTERNS.some((p) => p.test('sg-0123456789abcdef0'))).toBe(true);
      expect(BACKEND_HANDLE_PATTERNS.some((p) => p.test('vpc-0123456789abcdef0'))).toBe(true);
      expect(BACKEND_HANDLE_PATTERNS.some((p) => p.test('subnet-0123456789abcdef0'))).toBe(true);
      expect(BACKEND_HANDLE_PATTERNS.some((p) => p.test('i-0123456789abcdef0'))).toBe(true);
    });

    it('does not match valid node references', () => {
      expect(BACKEND_HANDLE_PATTERNS.some((p) => p.test('component:my-service'))).toBe(false);
      expect(BACKEND_HANDLE_PATTERNS.some((p) => p.test('platform:aws-sqs'))).toBe(false);
      expect(BACKEND_HANDLE_PATTERNS.some((p) => p.test('node:lambda-function'))).toBe(false);
    });
  });

  describe('detectBackendHandles', () => {
    it('returns empty array for clean object', () => {
      const intent = {
        type: 'iam',
        principal: { nodeRef: 'component:my-service' },
        resource: { nodeRef: 'platform:sqs-queue' },
      };

      const errors = detectBackendHandles(intent, '$');
      expect(errors).toEqual([]);
    });

    it('detects ARN in simple field', () => {
      const intent = {
        type: 'iam',
        resource: 'arn:aws:sqs:us-east-1:123456789012:my-queue',
      };

      const errors = detectBackendHandles(intent, '$');
      expect(errors).toHaveLength(1);
      expect(errors[0].rule).toBe('backend-handle-detected');
      expect(errors[0].path).toBe('$.resource');
      expect(errors[0].kernelLaw).toBe('KL-001');
    });

    it('detects ARN in nested object', () => {
      const intent = {
        type: 'iam',
        resource: {
          arn: 'arn:aws:lambda:us-west-2:123456789012:function:my-func',
        },
      };

      const errors = detectBackendHandles(intent, '$');
      expect(errors).toHaveLength(1);
      expect(errors[0].path).toBe('$.resource.arn');
    });

    it('detects security group ID', () => {
      const intent = {
        type: 'network',
        securityGroup: 'sg-0123456789abcdef0',
      };

      const errors = detectBackendHandles(intent, '$');
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('sg-');
    });

    it('detects VPC ID', () => {
      const intent = {
        type: 'network',
        vpc: 'vpc-0123456789abcdef0',
      };

      const errors = detectBackendHandles(intent, '$');
      expect(errors).toHaveLength(1);
    });

    it('detects handles in arrays', () => {
      const intent = {
        type: 'iam',
        resources: [
          'arn:aws:s3:::bucket-1',
          'component:valid',
          'arn:aws:s3:::bucket-2',
        ],
      };

      const errors = detectBackendHandles(intent, '$');
      expect(errors).toHaveLength(2);
      expect(errors[0].path).toBe('$.resources[0]');
      expect(errors[1].path).toBe('$.resources[2]');
    });

    it('scans deeply nested structures', () => {
      const intent = {
        level1: {
          level2: {
            level3: {
              badValue: 'arn:aws:iam::123456789012:role/my-role',
            },
          },
        },
      };

      const errors = detectBackendHandles(intent, '$');
      expect(errors).toHaveLength(1);
      expect(errors[0].path).toBe('$.level1.level2.level3.badValue');
    });

    it('provides remediation guidance', () => {
      const intent = {
        resource: 'arn:aws:sqs:us-east-1:123456789012:my-queue',
      };

      const errors = detectBackendHandles(intent, '$');
      expect(errors[0].remediation).toBeDefined();
      expect(errors[0].remediation).toContain('node reference');
    });
  });

  describe('detectPackBranching', () => {
    it('returns empty array for clean object', () => {
      const component = {
        type: 'component',
        config: { region: 'us-east-1' },
      };

      const errors = detectPackBranching(component, '$');
      expect(errors).toEqual([]);
    });

    it('detects policyPack field in component', () => {
      const component = {
        type: 'component',
        policyPack: 'fedramp-high',
      };

      const errors = detectPackBranching(component, '$');
      expect(errors).toHaveLength(1);
      expect(errors[0].rule).toBe('pack-branching-detected');
      expect(errors[0].message).toContain('policyPack');
    });

    it('detects if statement referencing policy pack', () => {
      const binder = {
        logic: 'if (policyPack === "baseline") { return x; }',
      };

      const errors = detectPackBranching(binder, '$');
      expect(errors).toHaveLength(1);
      expect(errors[0].rule).toBe('pack-branching-detected');
    });

    it('detects switch on policy pack', () => {
      const binder = {
        logic: 'switch(policyPack) { case "fedramp": break; }',
      };

      const errors = detectPackBranching(binder, '$');
      expect(errors).toHaveLength(1);
    });

    it('detects pack reference in nested object', () => {
      const component = {
        nested: {
          config: {
            whenPolicyPack: 'fedramp-moderate',
          },
        },
      };

      const errors = detectPackBranching(component, '$');
      expect(errors).toHaveLength(1);
    });

    it('provides remediation guidance', () => {
      const component = {
        policyPack: 'baseline',
      };

      const errors = detectPackBranching(component, '$');
      expect(errors[0].remediation).toBeDefined();
    });
  });
});
