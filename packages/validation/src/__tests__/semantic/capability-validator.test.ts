import { describe, it, expect } from 'vitest';
import {
  validateCapabilityCompatibility,
  checkActionCompatibility,
} from '../../semantic/capability-validator';
import type { CapabilityContract, CapabilityAction } from '@shinobi/contracts';

describe('capability-validator', () => {
  const makeContract = (
    id: string,
    actions: CapabilityAction[] = ['read', 'write']
  ): CapabilityContract => ({
    id: id as `${string}:${string}@${string}`,
    schemaVersion: '1.0.0',
    description: 'Test capability',
    dataShape: { fields: {} },
    actions,
  });

  describe('checkActionCompatibility', () => {
    it('returns empty array when all required actions are available', () => {
      const errors = checkActionCompatibility(
        'aws:sqs@1.0.0',
        ['read', 'write'],
        ['read'],
        '$.bindings[0]'
      );
      expect(errors).toEqual([]);
    });

    it('returns error when required action is not available', () => {
      const errors = checkActionCompatibility(
        'aws:sqs@1.0.0',
        ['read'],
        ['write'],
        '$.bindings[0]'
      );
      expect(errors).toHaveLength(1);
      expect(errors[0].rule).toBe('incompatible-capability-action');
      expect(errors[0].kernelLaw).toBe('KL-003');
    });

    it('returns error for each missing action', () => {
      const errors = checkActionCompatibility(
        'aws:sqs@1.0.0',
        ['read'],
        ['write', 'admin'],
        '$.bindings[0]'
      );
      expect(errors).toHaveLength(2);
    });

    it('includes allowed values in error', () => {
      const errors = checkActionCompatibility(
        'aws:sqs@1.0.0',
        ['read', 'invoke'],
        ['write'],
        '$.bindings[0]'
      );
      expect(errors[0].allowedValues).toEqual(['read', 'invoke']);
    });
  });

  describe('validateCapabilityCompatibility', () => {
    it('returns valid result when capabilities are compatible', () => {
      const provider = makeContract('aws:sqs-queue@1.0.0', ['read', 'write']);
      const consumer = makeContract('core:queue-consumer@1.0.0', ['read']);

      const result = validateCapabilityCompatibility(provider, consumer, '$');
      expect(result.valid).toBe(true);
    });

    it('returns error when consumer requires unavailable action', () => {
      const provider = makeContract('aws:sqs-queue@1.0.0', ['read']);
      const consumer = makeContract('core:queue-consumer@1.0.0', ['read', 'write']);

      const result = validateCapabilityCompatibility(provider, consumer, '$');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === 'incompatible-capability-action')).toBe(true);
    });

    it('returns error when consumer requires admin but provider only has read/write', () => {
      const provider = makeContract('aws:sqs-queue@1.0.0', ['read', 'write']);
      const consumer = makeContract('core:queue-admin@1.0.0', ['admin']);

      const result = validateCapabilityCompatibility(provider, consumer, '$');
      expect(result.valid).toBe(false);
    });

    it('includes provider ID in error message', () => {
      const provider = makeContract('aws:sqs-queue@1.0.0', ['read']);
      const consumer = makeContract('core:queue-consumer@1.0.0', ['write']);

      const result = validateCapabilityCompatibility(provider, consumer, '$');
      expect(result.errors[0].message).toContain('aws:sqs-queue@1.0.0');
    });

    it('handles empty consumer actions (no requirements)', () => {
      const provider = makeContract('aws:sqs-queue@1.0.0', ['read', 'write']);
      const consumer: CapabilityContract = {
        ...makeContract('core:observer@1.0.0'),
        actions: [],
      };

      const result = validateCapabilityCompatibility(provider, consumer, '$');
      expect(result.valid).toBe(true);
    });

    it('handles provider with all actions', () => {
      const provider = makeContract('aws:sqs-queue@1.0.0', ['read', 'write', 'admin', 'invoke']);
      const consumer = makeContract('core:admin@1.0.0', ['admin', 'invoke']);

      const result = validateCapabilityCompatibility(provider, consumer, '$');
      expect(result.valid).toBe(true);
    });
  });
});
