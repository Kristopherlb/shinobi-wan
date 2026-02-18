import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../commands/validate', () => ({
  validate: vi.fn(() => ({
    success: true,
    errors: [],
    manifest: { service: 'svc', components: 1, bindings: 1 },
  })),
}));

vi.mock('../../commands/plan', () => ({
  plan: vi.fn(() => ({
    success: true,
    errors: [],
    validation: { success: true, errors: [] },
    plan: { resources: [{ name: 'r1', resourceType: 'aws:s3:Bucket', properties: {}, dependsOn: [] }], outputs: {} },
  })),
}));

vi.mock('../../commands/up', () => ({
  up: vi.fn(async () => ({
    success: true,
    deployed: true,
    message: 'ok',
    plan: { success: true, validation: { success: true, errors: [] }, errors: [] },
  })),
}));

import { getOperationStatus, invokeHarmonyTool } from '../wrapper';
import { validate } from '../../commands/validate';

describe('harmony wrapper', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    process.env.SHINOBI_WRAPPER_MODE_ENABLED = 'true';
    process.env.SHINOBI_APPLY_ENABLED = 'false';
    process.env.SHINOBI_TOOL_VERSION = '1.2.3';
    process.env.SHINOBI_CONTRACT_VERSION = '1.0.0';
    process.env.SHINOBI_APPLY_MODE = 'start';
    process.env.SHINOBI_APPROVAL_REQUIRED = 'true';
    process.env.SHINOBI_APPROVAL_MAX_SLA_MINUTES = '60';
    process.env.SHINOBI_HARMONY_WORKFLOW_NAME = 'shinobi-apply-workflow';
    process.env.SHINOBI_HARMONY_TASK_QUEUE = 'shinobi-apply-queue';
    process.env.SHINOBI_HARMONY_STATUS_BASE_URL = 'https://harmony.local';
    process.env.SHINOBI_HARMONY_DISPATCH_URL = 'https://harmony.local/operations/dispatch';
    vi.stubGlobal('fetch', fetchMock);
  });

  it('maps validate tool to plan-class envelope', async () => {
    const response = await invokeHarmonyTool({
      toolId: 'golden.shinobi.validate_plan',
      traceId: 'trace-1',
      input: { manifestPath: 'examples/lambda-sqs.yaml' },
    });

    expect(response.envelope.success).toBe(true);
    expect(response.envelope.metadata.toolId).toBe('golden.shinobi.validate_plan');
    expect(response.envelope.metadata.operationClass).toBe('plan');
  });

  it('rejects apply when feature flag is disabled', async () => {
    const response = await invokeHarmonyTool({
      toolId: 'golden.shinobi.apply_change',
      traceId: 'trace-2',
      input: { manifestPath: 'examples/lambda-sqs.yaml', planFingerprint: 'x', idempotencyKey: 'k1' },
    });

    expect(response.envelope.success).toBe(false);
    expect(response.envelope.error?.code).toBe('APPROVAL_REQUIRED');
  });

  it('returns async handle for apply start mode when enabled', async () => {
    process.env.SHINOBI_APPLY_ENABLED = 'true';
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      operationId: 'operation-123',
      workflowId: 'workflow-123',
      submittedAt: '2026-02-16T00:00:00.000Z',
      statusUrl: 'https://harmony.local/operations/operation-123',
      cancelUrl: 'https://harmony.local/operations/operation-123/cancel',
    }), { status: 202 }));

    const planResponse = await invokeHarmonyTool({
      toolId: 'golden.shinobi.plan_change',
      traceId: 'trace-plan',
      input: { manifestPath: 'examples/lambda-sqs.yaml' },
    });
    const planFingerprint = (
      planResponse.envelope.data as { planFingerprint?: string } | undefined
    )?.planFingerprint;
    expect(planFingerprint).toBeDefined();

    const response = await invokeHarmonyTool({
      toolId: 'golden.shinobi.apply_change',
      traceId: 'trace-3',
      input: {
        manifestPath: 'examples/lambda-sqs.yaml',
        mode: 'start',
        planFingerprint: planFingerprint!,
        idempotencyKey: 'apply-1',
        approval: {
          approvalId: 'apr-1',
          approverRole: 'harmony-release-manager',
          approverId: 'user-1',
          decision: 'approved',
          decidedAt: '2026-02-16T00:01:00.000Z',
          slaMinutes: 30,
        },
      },
    });

    expect(response.envelope.success).toBe(true);
    expect(response.handle?.operationId).toBe('operation-123');
    expect(response.handle?.workflowId).toBe('workflow-123');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://harmony.local/operations/dispatch',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('keeps plan fingerprint stable when apply manifest path has surrounding whitespace', async () => {
    process.env.SHINOBI_APPLY_ENABLED = 'true';
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      operationId: 'operation-456',
      workflowId: 'workflow-456',
      submittedAt: '2026-02-16T00:00:00.000Z',
      statusUrl: 'https://harmony.local/operations/operation-456',
    }), { status: 202 }));

    const planResponse = await invokeHarmonyTool({
      toolId: 'golden.shinobi.plan_change',
      traceId: 'trace-plan-whitespace',
      input: { manifestPath: 'examples/lambda-sqs.yaml' },
    });
    const planFingerprint = (
      planResponse.envelope.data as { planFingerprint?: string } | undefined
    )?.planFingerprint;
    expect(planFingerprint).toBeDefined();

    const applyResponse = await invokeHarmonyTool({
      toolId: 'golden.shinobi.apply_change',
      traceId: 'trace-apply-whitespace',
      input: {
        manifestPath: ' examples/lambda-sqs.yaml ',
        mode: 'start',
        planFingerprint: planFingerprint!,
        idempotencyKey: 'apply-whitespace-1',
        approval: {
          approvalId: 'apr-whitespace',
          approverRole: 'harmony-release-manager',
          approverId: 'user-whitespace',
          decision: 'approved',
          decidedAt: '2026-02-16T00:01:00.000Z',
          slaMinutes: 30,
        },
      },
    });

    expect(applyResponse.envelope.success).toBe(true);
    expect(applyResponse.handle?.operationId).toBe('operation-456');
  });

  it('reads operation status from workflow backend', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      status: 'running',
      traceId: 'trace-3',
      toolId: 'golden.shinobi.apply_change',
      startedAt: '2026-02-16T00:00:00.000Z',
    }), { status: 200 }));

    const status = await getOperationStatus('operation-123');
    expect(status?.status).toBe('running');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://harmony.local/operations/operation-123',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('rejects apply without plan fingerprint', async () => {
    process.env.SHINOBI_APPLY_ENABLED = 'true';
    const response = await invokeHarmonyTool({
      toolId: 'golden.shinobi.apply_change',
      traceId: 'trace-5',
      input: { manifestPath: 'examples/lambda-sqs.yaml', idempotencyKey: 'apply-2' },
    });

    expect(response.envelope.success).toBe(false);
    expect(response.envelope.error?.code).toBe('INPUT_VALIDATION_FAILED');
  });

  it('rejects apply when approval evidence is missing in restricted mode', async () => {
    process.env.SHINOBI_APPLY_ENABLED = 'true';
    const planResponse = await invokeHarmonyTool({
      toolId: 'golden.shinobi.plan_change',
      traceId: 'trace-plan-approval',
      input: { manifestPath: 'examples/lambda-sqs.yaml' },
    });
    const planFingerprint = (
      planResponse.envelope.data as { planFingerprint?: string } | undefined
    )?.planFingerprint;

    const response = await invokeHarmonyTool({
      toolId: 'golden.shinobi.apply_change',
      traceId: 'trace-approval-missing',
      input: {
        manifestPath: 'examples/lambda-sqs.yaml',
        mode: 'start',
        planFingerprint: planFingerprint!,
        idempotencyKey: 'apply-missing-approval',
      },
    });

    expect(response.envelope.success).toBe(false);
    expect(response.envelope.error?.code).toBe('APPROVAL_REQUIRED');
    expect(response.envelope.error?.category).toBe('authorization');
    expect(response.envelope.error?.details).toMatchObject({
      missingFields: ['approval'],
    });
  });

  it('rejects apply when approval decision is not approved', async () => {
    process.env.SHINOBI_APPLY_ENABLED = 'true';
    const planResponse = await invokeHarmonyTool({
      toolId: 'golden.shinobi.plan_change',
      traceId: 'trace-plan-rejected',
      input: { manifestPath: 'examples/lambda-sqs.yaml' },
    });
    const planFingerprint = (
      planResponse.envelope.data as { planFingerprint?: string } | undefined
    )?.planFingerprint;

    const response = await invokeHarmonyTool({
      toolId: 'golden.shinobi.apply_change',
      traceId: 'trace-approval-rejected',
      input: {
        manifestPath: 'examples/lambda-sqs.yaml',
        mode: 'start',
        planFingerprint: planFingerprint!,
        idempotencyKey: 'apply-rejected-approval',
        approval: {
          approvalId: 'apr-rejected',
          approverRole: 'harmony-release-manager',
          approverId: 'user-rejected',
          decision: 'rejected',
          decidedAt: '2026-02-16T00:01:00.000Z',
          slaMinutes: 30,
        },
      },
    });

    expect(response.envelope.success).toBe(false);
    expect(response.envelope.error?.code).toBe('APPROVAL_REQUIRED');
    expect(response.envelope.error?.details).toMatchObject({
      missingFields: ['approval.decision.approved'],
    });
  });

  it('blocks apply when harmony wiring is missing but keeps integration running', async () => {
    process.env.SHINOBI_APPLY_ENABLED = 'true';
    delete process.env.SHINOBI_HARMONY_WORKFLOW_NAME;
    const planResponse = await invokeHarmonyTool({
      toolId: 'golden.shinobi.plan_change',
      traceId: 'trace-plan-2',
      input: { manifestPath: 'examples/lambda-sqs.yaml' },
    });
    const planFingerprint = (
      planResponse.envelope.data as { planFingerprint?: string } | undefined
    )?.planFingerprint;

    const response = await invokeHarmonyTool({
      toolId: 'golden.shinobi.apply_change',
      traceId: 'trace-6',
      input: {
        manifestPath: 'examples/lambda-sqs.yaml',
        planFingerprint: planFingerprint!,
        idempotencyKey: 'apply-3',
        approval: {
          approvalId: 'apr-3',
          approverRole: 'harmony-release-manager',
          approverId: 'user-3',
          decision: 'approved',
          decidedAt: '2026-02-16T00:01:00.000Z',
          slaMinutes: 30,
        },
      },
    });

    expect(response.envelope.success).toBe(false);
    expect(response.envelope.error?.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(response.envelope.error?.retriable).toBe(true);
    expect(response.envelope.error?.retriableReason).toBe('dependency_unavailable');
  });

  it('fails apply start when workflow dispatch endpoint fails', async () => {
    process.env.SHINOBI_APPLY_ENABLED = 'true';
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      message: 'workflow backend unavailable',
    }), { status: 503 }));

    const planResponse = await invokeHarmonyTool({
      toolId: 'golden.shinobi.plan_change',
      traceId: 'trace-plan-3',
      input: { manifestPath: 'examples/lambda-sqs.yaml' },
    });
    const planFingerprint = (
      planResponse.envelope.data as { planFingerprint?: string } | undefined
    )?.planFingerprint;

    const response = await invokeHarmonyTool({
      toolId: 'golden.shinobi.apply_change',
      traceId: 'trace-7',
      input: {
        manifestPath: 'examples/lambda-sqs.yaml',
        mode: 'start',
        planFingerprint: planFingerprint!,
        idempotencyKey: 'apply-4',
        approval: {
          approvalId: 'apr-4',
          approverRole: 'harmony-release-manager',
          approverId: 'user-4',
          decision: 'approved',
          decidedAt: '2026-02-16T00:01:00.000Z',
          slaMinutes: 30,
        },
      },
    });

    expect(response.envelope.success).toBe(false);
    expect(response.envelope.error?.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(response.envelope.error?.retriable).toBe(true);
  });

  it('keeps read and plan operations healthy after apply dispatch failure', async () => {
    process.env.SHINOBI_APPLY_ENABLED = 'true';
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      message: 'workflow backend unavailable',
    }), { status: 503 }));

    const planResponse = await invokeHarmonyTool({
      toolId: 'golden.shinobi.plan_change',
      traceId: 'trace-plan-4',
      input: { manifestPath: 'examples/lambda-sqs.yaml' },
    });
    const planFingerprint = (
      planResponse.envelope.data as { planFingerprint?: string } | undefined
    )?.planFingerprint;

    const applyResponse = await invokeHarmonyTool({
      toolId: 'golden.shinobi.apply_change',
      traceId: 'trace-apply-fail',
      input: {
        manifestPath: 'examples/lambda-sqs.yaml',
        mode: 'start',
        planFingerprint: planFingerprint!,
        idempotencyKey: 'apply-5',
        approval: {
          approvalId: 'apr-5',
          approverRole: 'harmony-release-manager',
          approverId: 'user-5',
          decision: 'approved',
          decidedAt: '2026-02-16T00:01:00.000Z',
          slaMinutes: 30,
        },
      },
    });
    expect(applyResponse.envelope.success).toBe(false);
    expect(applyResponse.envelope.error?.code).toBe('DEPENDENCY_UNAVAILABLE');

    const validateResponse = await invokeHarmonyTool({
      toolId: 'golden.shinobi.validate_plan',
      traceId: 'trace-post-failure-validate',
      input: { manifestPath: 'examples/lambda-sqs.yaml' },
    });
    const readResponse = await invokeHarmonyTool({
      toolId: 'golden.shinobi.read_activity',
      traceId: 'trace-post-failure-read',
      input: { manifestPath: 'examples/lambda-sqs.yaml' },
    });

    expect(validateResponse.envelope.success).toBe(true);
    expect(readResponse.envelope.success).toBe(true);
  });

  it('returns read error envelope when validate or plan fails', async () => {
    vi.mocked(validate).mockReturnValueOnce({
      success: false,
      errors: [{ path: '$.service', message: 'invalid manifest' }],
    });

    const response = await invokeHarmonyTool({
      toolId: 'golden.shinobi.read_activity',
      traceId: 'trace-read-1',
      input: { manifestPath: 'examples/lambda-sqs.yaml' },
    });

    expect(response.envelope.success).toBe(false);
    expect(response.envelope.error?.code).toBe('INPUT_VALIDATION_FAILED');
    expect(response.envelope.error?.category).toBe('validation');
  });

  it('returns explicit unsupported envelope for rollback until native contract exists', async () => {
    const response = await invokeHarmonyTool({
      toolId: 'golden.shinobi.rollback_change',
      traceId: 'trace-4',
      input: {},
    });
    expect(response.envelope.success).toBe(false);
    expect(response.envelope.error?.message).toContain('Rollback is not yet a first-class Shinobi operation');
  });
});
