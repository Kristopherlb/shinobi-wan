import { randomUUID } from 'crypto';

export interface OperationStatusRecord {
  status: 'running' | 'succeeded' | 'failed' | 'cancelled' | 'timed_out';
  traceId: string;
  toolId: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface DispatchApplyWorkflowInput {
  readonly traceId: string;
  readonly toolId: string;
  readonly manifestPath: string;
  readonly policyPack?: string;
  readonly region?: string;
  readonly codePath?: string;
  readonly planFingerprint: string;
  readonly idempotencyKey: string;
}

export interface DispatchApplyWorkflowResult {
  readonly operationId: string;
  readonly workflowId: string;
  readonly submittedAt: string;
  readonly statusUrl: string;
  readonly cancelUrl?: string;
}

export interface WorkflowClient {
  dispatchApplyWorkflow(input: DispatchApplyWorkflowInput): Promise<DispatchApplyWorkflowResult>;
  getOperationStatus(operationId: string): Promise<OperationStatusRecord | undefined>;
}

interface WorkflowConfig {
  readonly workflowName: string;
  readonly taskQueue: string;
  readonly statusBaseUrl: string;
  readonly dispatchUrl: string;
}

function resolveWorkflowConfig(env: NodeJS.ProcessEnv = process.env): WorkflowConfig {
  const workflowName = env.SHINOBI_HARMONY_WORKFLOW_NAME;
  const taskQueue = env.SHINOBI_HARMONY_TASK_QUEUE;
  const statusBaseUrl = env.SHINOBI_HARMONY_STATUS_BASE_URL;
  const dispatchUrl = env.SHINOBI_HARMONY_DISPATCH_URL
    ?? (statusBaseUrl ? `${statusBaseUrl.replace(/\/$/, '')}/operations/dispatch` : undefined);

  if (!workflowName || !taskQueue || !statusBaseUrl || !dispatchUrl) {
    throw new Error('Harmony workflow wiring is incomplete');
  }

  return { workflowName, taskQueue, statusBaseUrl, dispatchUrl };
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  return JSON.parse(text) as unknown;
}

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Workflow dispatch response missing '${field}'`);
  }
  return value;
}

export function createHttpWorkflowClient(env: NodeJS.ProcessEnv = process.env): WorkflowClient {
  return {
    async dispatchApplyWorkflow(input: DispatchApplyWorkflowInput): Promise<DispatchApplyWorkflowResult> {
      const cfg = resolveWorkflowConfig(env);
      const operationId = randomUUID();
      const workflowId = `${cfg.workflowName}-${operationId}`;
      const submittedAt = new Date().toISOString();

      const response = await fetch(cfg.dispatchUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          operationId,
          workflowId,
          workflowName: cfg.workflowName,
          taskQueue: cfg.taskQueue,
          submittedAt,
          input,
        }),
      });

      if (!response.ok) {
        const errorBody = await parseJson(response);
        const details = typeof errorBody === 'object' && errorBody !== null
          ? JSON.stringify(errorBody)
          : String(errorBody ?? '');
        throw new Error(`Workflow dispatch failed with ${response.status}${details ? `: ${details}` : ''}`);
      }

      const payload = await parseJson(response) as Record<string, unknown>;
      return {
        operationId: asString(payload['operationId'], 'operationId'),
        workflowId: asString(payload['workflowId'], 'workflowId'),
        submittedAt: asString(payload['submittedAt'], 'submittedAt'),
        statusUrl: asString(payload['statusUrl'], 'statusUrl'),
        ...(typeof payload['cancelUrl'] === 'string' && payload['cancelUrl'].length > 0
          ? { cancelUrl: payload['cancelUrl'] }
          : {}),
      };
    },

    async getOperationStatus(operationId: string): Promise<OperationStatusRecord | undefined> {
      const cfg = resolveWorkflowConfig(env);
      const url = `${cfg.statusBaseUrl.replace(/\/$/, '')}/operations/${operationId}`;
      const response = await fetch(url, { method: 'GET' });
      if (response.status === 404) return undefined;
      if (!response.ok) {
        throw new Error(`Failed to fetch operation status (${response.status})`);
      }
      const payload = await parseJson(response);
      if (!payload || typeof payload !== 'object') return undefined;
      const record = payload as Record<string, unknown>;
      return {
        status: asString(record['status'], 'status') as OperationStatusRecord['status'],
        traceId: asString(record['traceId'], 'traceId'),
        toolId: asString(record['toolId'], 'toolId'),
        startedAt: asString(record['startedAt'], 'startedAt'),
        ...(typeof record['completedAt'] === 'string' ? { completedAt: record['completedAt'] } : {}),
        ...(typeof record['error'] === 'string' ? { error: record['error'] } : {}),
      };
    },
  };
}
