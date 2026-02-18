import type {
  OperationClass,
  RetriableReason,
  TerminalOperationState,
} from './contract';

export type { OperationClass, RetriableReason, TerminalOperationState } from './contract';

export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly initialIntervalSeconds: number;
  readonly backoffCoefficient: number;
}

export interface OperationPolicy {
  readonly operationClass: OperationClass;
  readonly defaultTimeoutMs: number;
  readonly maxTimeoutMs: number;
  readonly retryPolicy: RetryPolicy;
  readonly idempotency: 'required' | 'recommended' | 'optional';
  readonly mode: 'await' | 'start';
}

export type ToolErrorEnvelope = {
  readonly code: string;
  readonly category: 'validation' | 'authorization' | 'upstream' | 'runtime' | 'conflict' | 'unknown';
  readonly source: string;
  readonly traceId: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
} & (
  | { readonly retriable: true; readonly retriableReason: RetriableReason }
  | { readonly retriable: false; readonly retriableReason?: never }
);

export interface ToolMetadata {
  readonly toolId: string;
  readonly toolVersion: string;
  readonly contractVersion: string;
  readonly operationClass: OperationClass;
  readonly traceId: string;
  readonly timestamp: string;
}

export interface ToolResponseEnvelope<T> {
  readonly success: boolean;
  readonly metadata: ToolMetadata;
  readonly policy: OperationPolicy;
  readonly data?: T;
  readonly error?: ToolErrorEnvelope;
}

export interface AsyncOperationHandle {
  readonly operationId: string;
  readonly traceId: string;
  readonly workflowId: string;
  readonly submittedAt: string;
  readonly statusUrl: string;
  readonly terminalStates: ReadonlyArray<TerminalOperationState>;
  readonly terminalStateRetryable: Readonly<Record<TerminalOperationState, boolean>>;
  readonly cancelUrl?: string;
}

export interface IntegrationFeatureFlags {
  readonly wrapperModeEnabled: boolean;
  readonly applyEnabled: boolean;
  readonly applyMode: 'start' | 'await';
  readonly approvalRequired: boolean;
  readonly approvalMaxSlaMinutes: number;
  readonly contractVersion: string;
  readonly toolVersion: string;
  readonly maxConcurrency: number;
}
