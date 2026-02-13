import { describe, it, expect } from 'vitest';
import {
  CAPABILITY_ID_PATTERN,
  isValidCapabilityId,
  CAPABILITY_ACTIONS,
  type CapabilityId,
  type CapabilityContract,
  type CapabilityDataShape,
  type CapabilityFieldType,
  type CapabilityAction,
} from '../capability/index';
import { CONTRACT_SCHEMA_VERSION } from '../versions';

describe('CapabilityId', () => {
  describe('format validation', () => {
    it('accepts valid capability IDs: namespace:name@version', () => {
      expect(isValidCapabilityId('aws:sqs-queue@1.0.0')).toBe(true);
      expect(isValidCapabilityId('core:http-endpoint@2.1.0')).toBe(true);
      expect(isValidCapabilityId('shinobi:lambda-function@0.1.0')).toBe(true);
    });

    it('rejects IDs without namespace', () => {
      expect(isValidCapabilityId('sqs-queue@1.0.0')).toBe(false);
    });

    it('rejects IDs without version', () => {
      expect(isValidCapabilityId('aws:sqs-queue')).toBe(false);
    });

    it('rejects IDs with invalid version format', () => {
      expect(isValidCapabilityId('aws:sqs-queue@1.0')).toBe(false);
      expect(isValidCapabilityId('aws:sqs-queue@v1.0.0')).toBe(false);
    });

    it('rejects IDs with uppercase letters', () => {
      expect(isValidCapabilityId('AWS:sqs-queue@1.0.0')).toBe(false);
      expect(isValidCapabilityId('aws:SQS-Queue@1.0.0')).toBe(false);
    });

    it('rejects empty strings', () => {
      expect(isValidCapabilityId('')).toBe(false);
    });

    it('CAPABILITY_ID_PATTERN matches expected format', () => {
      expect(CAPABILITY_ID_PATTERN.test('aws:sqs-queue@1.0.0')).toBe(true);
      expect(CAPABILITY_ID_PATTERN.test('invalid')).toBe(false);
    });
  });
});

describe('CapabilityContract', () => {
  it('has required fields: id, schemaVersion, description, dataShape, actions', () => {
    const contract: CapabilityContract = {
      id: 'aws:sqs-queue@1.0.0' as CapabilityId,
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      description: 'Amazon SQS Queue capability',
      dataShape: {
        fields: {
          queueUrl: { type: 'string' },
          queueArn: { type: 'string' },
        },
      },
      actions: ['read', 'write'],
    };

    expect(contract.id).toBe('aws:sqs-queue@1.0.0');
    expect(contract.schemaVersion).toBe('1.0.0');
    expect(contract.description).toBe('Amazon SQS Queue capability');
    expect(contract.dataShape.fields).toHaveProperty('queueUrl');
    expect(contract.actions).toContain('read');
  });

  it('schemaVersion is always 1.0.0', () => {
    const contract: CapabilityContract = {
      id: 'core:test@1.0.0' as CapabilityId,
      schemaVersion: '1.0.0',
      description: 'Test',
      dataShape: { fields: {} },
      actions: [],
    };

    expect(contract.schemaVersion).toBe('1.0.0');
  });
});

describe('CapabilityDataShape', () => {
  it('defines fields with no provider-specific constructs', () => {
    const shape: CapabilityDataShape = {
      fields: {
        url: { type: 'string' },
        port: { type: 'number' },
        enabled: { type: 'boolean' },
      },
    };

    expect(shape.fields.url.type).toBe('string');
    expect(shape.fields.port.type).toBe('number');
    expect(shape.fields.enabled.type).toBe('boolean');
  });

  it('supports reference fields to other capabilities', () => {
    const shape: CapabilityDataShape = {
      fields: {
        targetQueue: {
          type: 'reference',
          targetCapability: 'aws:sqs-queue@1.0.0' as CapabilityId,
        },
      },
    };

    const refField = shape.fields.targetQueue as { type: 'reference'; targetCapability: CapabilityId };
    expect(refField.type).toBe('reference');
    expect(refField.targetCapability).toBe('aws:sqs-queue@1.0.0');
  });
});

describe('CapabilityAction', () => {
  it('supports standard action levels', () => {
    const actions: CapabilityAction[] = ['read', 'write', 'admin', 'invoke'];

    expect(CAPABILITY_ACTIONS).toEqual(['read', 'write', 'admin', 'invoke']);
    actions.forEach((action) => {
      expect(CAPABILITY_ACTIONS).toContain(action);
    });
  });
});
