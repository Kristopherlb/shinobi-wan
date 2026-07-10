import { describe, it, expect } from 'vitest';
import {
  CAPABILITY_ID_PATTERN,
  isValidCapabilityId,
  CAPABILITY_ACTIONS,
} from '../capability/index';

describe('isValidCapabilityId', () => {
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
});

describe('CAPABILITY_ID_PATTERN', () => {
  it('matches expected format', () => {
    expect(CAPABILITY_ID_PATTERN.test('aws:sqs-queue@1.0.0')).toBe(true);
    expect(CAPABILITY_ID_PATTERN.test('invalid')).toBe(false);
  });
});

describe('CAPABILITY_ACTIONS', () => {
  it('contains standard action levels', () => {
    expect(CAPABILITY_ACTIONS).toEqual(['read', 'write', 'admin', 'invoke']);
  });
});
