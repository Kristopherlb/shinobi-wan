/**
 * Canonical Harmony integration contract source of truth.
 * Keep this file as the normative reference for envelope fields and enums.
 */

export const CONTRACT_VERSION = '1.1.0' as const;
export const DEFAULT_TOOL_VERSION = '0.1.0' as const;

export const OPERATION_CLASSES = ['read', 'plan', 'apply'] as const;
export type OperationClass = (typeof OPERATION_CLASSES)[number];

export const RETRIABLE_REASONS = [
  'rate_limit',
  'upstream_timeout',
  'upstream_5xx',
  'transport_unavailable',
  'worker_unavailable',
  'dependency_unavailable',
] as const;
export type RetriableReason = (typeof RETRIABLE_REASONS)[number];

export const TERMINAL_OPERATION_STATES = [
  'succeeded',
  'failed',
  'cancelled',
  'timed_out',
] as const;
export type TerminalOperationState = (typeof TERMINAL_OPERATION_STATES)[number];

export const TERMINAL_STATE_RETRYABLE: Readonly<Record<TerminalOperationState, boolean>> = {
  succeeded: false,
  failed: true,
  cancelled: true,
  timed_out: true,
};

export const ENVELOPE_COMPATIBILITY_POLICY = {
  additiveField: 'minor',
  removalOrTypeChange: 'major',
  requiredReleaseGate: 'golden-compatibility-tests',
} as const;

export const ENVELOPE_SCHEMA_SUMMARY = {
  requiredMetadataFields: [
    'toolId',
    'toolVersion',
    'contractVersion',
    'operationClass',
    'traceId',
    'timestamp',
  ],
  requiredErrorFields: [
    'code',
    'category',
    'retriable',
    'source',
    'traceId',
    'message',
  ],
  requiredWhenRetriable: ['retriableReason'],
} as const;
