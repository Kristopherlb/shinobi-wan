import { TERMINAL_OPERATION_STATES, TERMINAL_STATE_RETRYABLE } from './contract';
import type { AsyncOperationHandle } from './types';

export interface CreateAsyncOperationHandleInput {
  readonly operationId: string;
  readonly traceId: string;
  readonly workflowId: string;
  readonly submittedAt: string;
  readonly statusUrl: string;
  readonly cancelUrl?: string;
}

/**
 * Builds a deterministic async operation handle for apply/start mode.
 */
export function createAsyncOperationHandle(
  input: CreateAsyncOperationHandleInput,
): AsyncOperationHandle {
  return {
    operationId: input.operationId,
    traceId: input.traceId,
    workflowId: input.workflowId,
    submittedAt: input.submittedAt,
    statusUrl: input.statusUrl,
    terminalStates: TERMINAL_OPERATION_STATES,
    terminalStateRetryable: TERMINAL_STATE_RETRYABLE,
    ...(input.cancelUrl ? { cancelUrl: input.cancelUrl } : {}),
  };
}
