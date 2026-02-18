import { describe, expect, it } from 'vitest';
import {
  CONTRACT_VERSION,
  ENVELOPE_COMPATIBILITY_POLICY,
  ENVELOPE_SCHEMA_SUMMARY,
  OPERATION_CLASSES,
  RETRIABLE_REASONS,
  TERMINAL_STATE_RETRYABLE,
} from '../index';

describe('integration contract compatibility', () => {
  it('defines canonical operation class enum', () => {
    expect(OPERATION_CLASSES).toEqual(['read', 'plan', 'apply']);
  });

  it('defines canonical retriable reason enum', () => {
    expect(RETRIABLE_REASONS).toEqual([
      'rate_limit',
      'upstream_timeout',
      'upstream_5xx',
      'transport_unavailable',
      'worker_unavailable',
      'dependency_unavailable',
    ]);
  });

  it('requires operationClass in metadata schema summary', () => {
    expect(ENVELOPE_SCHEMA_SUMMARY.requiredMetadataFields).toContain('operationClass');
  });

  it('requires retriableReason when retriable=true', () => {
    expect(ENVELOPE_SCHEMA_SUMMARY.requiredWhenRetriable).toContain('retriableReason');
  });

  it('tracks compatibility policy semantics', () => {
    expect(ENVELOPE_COMPATIBILITY_POLICY.additiveField).toBe('minor');
    expect(ENVELOPE_COMPATIBILITY_POLICY.removalOrTypeChange).toBe('major');
    expect(ENVELOPE_COMPATIBILITY_POLICY.requiredReleaseGate).toBe('golden-compatibility-tests');
  });

  it('defines terminal state retryability map', () => {
    expect(TERMINAL_STATE_RETRYABLE.succeeded).toBe(false);
    expect(TERMINAL_STATE_RETRYABLE.failed).toBe(true);
    expect(TERMINAL_STATE_RETRYABLE.cancelled).toBe(true);
    expect(TERMINAL_STATE_RETRYABLE.timed_out).toBe(true);
  });

  it('exposes a semantic contract version', () => {
    expect(CONTRACT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
