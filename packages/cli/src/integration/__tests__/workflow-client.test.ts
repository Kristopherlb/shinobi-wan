import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHttpWorkflowClient } from '../workflow-client';

describe('workflow-client', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('dispatches apply workflow using configured workflow and task queue', async () => {
    const env = {
      SHINOBI_HARMONY_WORKFLOW_NAME: 'shinobi-apply-workflow',
      SHINOBI_HARMONY_TASK_QUEUE: 'shinobi-apply-queue',
      SHINOBI_HARMONY_STATUS_BASE_URL: 'https://harmony.local',
      SHINOBI_HARMONY_DISPATCH_URL: 'https://harmony.local/operations/dispatch',
    } as NodeJS.ProcessEnv;

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      operationId: 'op-1',
      workflowId: 'wf-1',
      submittedAt: '2026-02-16T00:00:00.000Z',
      statusUrl: 'https://harmony.local/operations/op-1',
    }), { status: 202 }));

    const client = createHttpWorkflowClient(env);
    const result = await client.dispatchApplyWorkflow({
      traceId: 'trace-1',
      toolId: 'golden.shinobi.apply_change',
      manifestPath: 'examples/lambda-sqs.yaml',
      planFingerprint: 'fp-1',
      idempotencyKey: 'idem-1',
    });

    expect(result.operationId).toBe('op-1');
    expect(result.workflowId).toBe('wf-1');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://harmony.local/operations/dispatch',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('returns external operation status from status endpoint', async () => {
    const env = {
      SHINOBI_HARMONY_WORKFLOW_NAME: 'shinobi-apply-workflow',
      SHINOBI_HARMONY_TASK_QUEUE: 'shinobi-apply-queue',
      SHINOBI_HARMONY_STATUS_BASE_URL: 'https://harmony.local',
      SHINOBI_HARMONY_DISPATCH_URL: 'https://harmony.local/operations/dispatch',
    } as NodeJS.ProcessEnv;

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      status: 'running',
      traceId: 'trace-1',
      toolId: 'golden.shinobi.apply_change',
      startedAt: '2026-02-16T00:00:00.000Z',
    }), { status: 200 }));

    const client = createHttpWorkflowClient(env);
    const status = await client.getOperationStatus('op-1');
    expect(status?.status).toBe('running');
  });
});
