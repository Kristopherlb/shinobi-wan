import { describe, expect, it } from 'vitest';
import { createAsyncOperationHandle } from '../index';

describe('async apply handle contract', () => {
  it('includes required async handle fields', () => {
    const handle = createAsyncOperationHandle({
      operationId: 'op-123',
      traceId: 'trace-123',
      workflowId: 'wf-123',
      statusUrl: 'https://example/status/op-123',
      submittedAt: '2026-02-16T00:00:00.000Z',
    });

    expect(handle.operationId).toBe('op-123');
    expect(handle.traceId).toBe('trace-123');
    expect(handle.workflowId).toBe('wf-123');
    expect(handle.statusUrl).toBe('https://example/status/op-123');
    expect(handle.terminalStates).toEqual(['succeeded', 'failed', 'cancelled', 'timed_out']);
  });

  it('includes terminal state retryability map', () => {
    const handle = createAsyncOperationHandle({
      operationId: 'op-123',
      traceId: 'trace-123',
      workflowId: 'wf-123',
      statusUrl: 'https://example/status/op-123',
      submittedAt: '2026-02-16T00:00:00.000Z',
    });

    expect(handle.terminalStateRetryable.succeeded).toBe(false);
    expect(handle.terminalStateRetryable.failed).toBe(true);
    expect(handle.terminalStateRetryable.cancelled).toBe(true);
    expect(handle.terminalStateRetryable.timed_out).toBe(true);
  });

  it('supports optional cancelUrl', () => {
    const handle = createAsyncOperationHandle({
      operationId: 'op-123',
      traceId: 'trace-123',
      workflowId: 'wf-123',
      statusUrl: 'https://example/status/op-123',
      submittedAt: '2026-02-16T00:00:00.000Z',
      cancelUrl: 'https://example/cancel/op-123',
    });

    expect(handle.cancelUrl).toBe('https://example/cancel/op-123');
  });

  it('is deterministic for identical inputs', () => {
    const input = {
      operationId: 'op-123',
      traceId: 'trace-123',
      workflowId: 'wf-123',
      statusUrl: 'https://example/status/op-123',
      submittedAt: '2026-02-16T00:00:00.000Z',
    };
    const r1 = createAsyncOperationHandle(input);
    const r2 = createAsyncOperationHandle(input);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});
