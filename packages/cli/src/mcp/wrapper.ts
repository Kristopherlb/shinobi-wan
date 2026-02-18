import { createHash } from 'crypto';
import { plan } from '../commands/plan';
import { up } from '../commands/up';
import { validate } from '../commands/validate';
import {
  createAsyncOperationHandle,
  createHttpWorkflowClient,
  envelopePlanResult,
  envelopeUpResult,
  envelopeValidateResult,
  getIntegrationFeatureFlags,
} from '../integration';
import type { OperationStatusRecord } from '../integration';
import type {
  ApplyApprovalEvidence,
  ApplyChangeInput,
  HarmonyToolCallRequest,
  HarmonyToolCallResult,
  PlanChangeInput,
  ReadInput,
  ValidatePlanInput,
} from './types';

const workflowClient = createHttpWorkflowClient();

export async function getOperationStatus(operationId: string): Promise<OperationStatusRecord | undefined> {
  return workflowClient.getOperationStatus(operationId);
}

function getVersions() {
  const flags = getIntegrationFeatureFlags();
  return {
    toolVersion: flags.toolVersion,
    contractVersion: flags.contractVersion,
  };
}

function hasApplyWiring(): boolean {
  return Boolean(
    process.env.SHINOBI_HARMONY_WORKFLOW_NAME
    && process.env.SHINOBI_HARMONY_TASK_QUEUE
    && process.env.SHINOBI_HARMONY_STATUS_BASE_URL
    && process.env.SHINOBI_HARMONY_DISPATCH_URL,
  );
}

function normalizeManifestPath(manifestPath: string): string {
  return manifestPath.trim();
}

function computePlanFingerprint(input: PlanChangeInput): string {
  const normalized = JSON.stringify({
    manifestPath: normalizeManifestPath(input.manifestPath),
    policyPack: input.policyPack ?? '',
    region: input.region ?? 'us-east-1',
    codePath: input.codePath ?? '',
  });
  return createHash('sha256').update(normalized).digest('hex');
}

function validateApprovalEvidence(
  approval: ApplyApprovalEvidence | undefined,
  maxSlaMinutes: number,
): { valid: true } | { valid: false; missingFields: string[] } {
  if (!approval) {
    return { valid: false, missingFields: ['approval'] };
  }
  const missingFields: string[] = [];
  if (!approval.approvalId) missingFields.push('approval.approvalId');
  if (!approval.approverRole) missingFields.push('approval.approverRole');
  if (!approval.approverId) missingFields.push('approval.approverId');
  if (!approval.decision) missingFields.push('approval.decision');
  if (approval.decision && approval.decision !== 'approved') {
    missingFields.push('approval.decision.approved');
  }
  if (!approval.decidedAt) missingFields.push('approval.decidedAt');
  if (!Number.isFinite(approval.slaMinutes) || approval.slaMinutes <= 0) {
    missingFields.push('approval.slaMinutes');
  }
  if (Number.isFinite(approval.slaMinutes) && approval.slaMinutes > maxSlaMinutes) {
    missingFields.push('approval.slaMinutes.withinThreshold');
  }
  return missingFields.length === 0
    ? { valid: true }
    : { valid: false, missingFields };
}

export async function invokeHarmonyTool(
  request: HarmonyToolCallRequest,
): Promise<HarmonyToolCallResult> {
  const flags = getIntegrationFeatureFlags();
  const versions = getVersions();

  if (!flags.wrapperModeEnabled) {
    return {
      envelope: {
        success: false,
        metadata: {
          toolId: request.toolId,
          operationClass: 'read',
          traceId: request.traceId,
          toolVersion: versions.toolVersion,
          contractVersion: versions.contractVersion,
          timestamp: new Date().toISOString(),
        },
        policy: {
          operationClass: 'read',
          defaultTimeoutMs: 5_000,
          maxTimeoutMs: 15_000,
          retryPolicy: { maxAttempts: 1, initialIntervalSeconds: 1, backoffCoefficient: 1 },
          idempotency: 'optional',
          mode: 'await',
        },
        error: {
          code: 'RUNNER_ERROR',
          category: 'runtime',
          retriable: false,
          source: 'cli.mcp.wrapper',
          traceId: request.traceId,
          message: 'Wrapper mode is disabled by feature flag',
        },
      },
    };
  }

  switch (request.toolId) {
    case 'golden.shinobi.validate_plan':
      return runValidate(request.input as ValidatePlanInput, request.traceId, versions);
    case 'golden.shinobi.plan_change':
      return runPlan(request.input as PlanChangeInput, request.traceId, versions);
    case 'golden.shinobi.apply_change':
      return runApply(
        request.input as ApplyChangeInput,
        request.traceId,
        versions,
        flags.applyEnabled,
        flags.applyMode,
        flags.approvalRequired,
        flags.approvalMaxSlaMinutes,
      );
    case 'golden.shinobi.rollback_change':
      return runRollback(request.traceId, versions);
    case 'golden.shinobi.read_entities':
    case 'golden.shinobi.read_activity':
      return runReadProjection(request.toolId, request.input as ReadInput, request.traceId, versions);
  }
}

async function runValidate(
  input: ValidatePlanInput,
  traceId: string,
  versions: { toolVersion: string; contractVersion: string },
): Promise<HarmonyToolCallResult> {
  const result = validate({
    manifestPath: normalizeManifestPath(input.manifestPath),
    policyPack: input.policyPack,
    json: true,
  });

  return {
    envelope: envelopeValidateResult(result, {
      toolId: 'golden.shinobi.validate_plan',
      operationClass: 'plan',
      traceId,
      ...versions,
    }),
  };
}

async function runPlan(
  input: PlanChangeInput,
  traceId: string,
  versions: { toolVersion: string; contractVersion: string },
): Promise<HarmonyToolCallResult> {
  const result = plan({
    manifestPath: normalizeManifestPath(input.manifestPath),
    policyPack: input.policyPack,
    region: input.region,
    codePath: input.codePath,
    json: true,
  });

  const envelope = envelopePlanResult(result, {
    toolId: 'golden.shinobi.plan_change',
    operationClass: 'plan',
    traceId,
    ...versions,
  });
  if (result.success) {
    const planFingerprint = computePlanFingerprint(input);
    return {
      envelope: {
        ...envelope,
        data: {
          planFingerprint,
          planResult: result,
        },
      },
    };
  }
  return { envelope };
}

async function runApply(
  input: ApplyChangeInput,
  traceId: string,
  versions: { toolVersion: string; contractVersion: string },
  applyEnabled: boolean,
  defaultMode: 'start' | 'await',
  approvalRequired: boolean,
  approvalMaxSlaMinutes: number,
): Promise<HarmonyToolCallResult> {
  if (!applyEnabled) {
    return {
      envelope: {
        success: false,
        metadata: {
          toolId: 'golden.shinobi.apply_change',
          operationClass: 'apply',
          traceId,
          toolVersion: versions.toolVersion,
          contractVersion: versions.contractVersion,
          timestamp: new Date().toISOString(),
        },
        policy: {
          operationClass: 'apply',
          defaultTimeoutMs: 30_000,
          maxTimeoutMs: 120_000,
          retryPolicy: { maxAttempts: 1, initialIntervalSeconds: 1, backoffCoefficient: 1 },
          idempotency: 'required',
          mode: 'start',
        },
        error: {
          code: 'APPROVAL_REQUIRED',
          category: 'authorization',
          retriable: false,
          source: 'cli.mcp.wrapper',
          traceId,
          message: 'Apply is disabled by rollout gate',
        },
      },
    };
  }

  if (!input.planFingerprint) {
    return {
      envelope: {
        success: false,
        metadata: {
          toolId: 'golden.shinobi.apply_change',
          operationClass: 'apply',
          traceId,
          toolVersion: versions.toolVersion,
          contractVersion: versions.contractVersion,
          timestamp: new Date().toISOString(),
        },
        policy: {
          operationClass: 'apply',
          defaultTimeoutMs: 30_000,
          maxTimeoutMs: 120_000,
          retryPolicy: { maxAttempts: 1, initialIntervalSeconds: 1, backoffCoefficient: 1 },
          idempotency: 'required',
          mode: 'start',
        },
        error: {
          code: 'INPUT_VALIDATION_FAILED',
          category: 'validation',
          retriable: false,
          source: 'cli.mcp.wrapper',
          traceId,
          message: 'planFingerprint is required for apply operations.',
        },
      },
    };
  }

  if (!input.idempotencyKey) {
    return {
      envelope: {
        success: false,
        metadata: {
          toolId: 'golden.shinobi.apply_change',
          operationClass: 'apply',
          traceId,
          toolVersion: versions.toolVersion,
          contractVersion: versions.contractVersion,
          timestamp: new Date().toISOString(),
        },
        policy: {
          operationClass: 'apply',
          defaultTimeoutMs: 30_000,
          maxTimeoutMs: 120_000,
          retryPolicy: { maxAttempts: 1, initialIntervalSeconds: 1, backoffCoefficient: 1 },
          idempotency: 'required',
          mode: 'start',
        },
        error: {
          code: 'INPUT_VALIDATION_FAILED',
          category: 'validation',
          retriable: false,
          source: 'cli.mcp.wrapper',
          traceId,
          message: 'idempotencyKey is required for apply operations.',
        },
      },
    };
  }

  if (approvalRequired) {
    const approvalValidation = validateApprovalEvidence(input.approval, approvalMaxSlaMinutes);
    if (!approvalValidation.valid) {
      return {
        envelope: {
          success: false,
          metadata: {
            toolId: 'golden.shinobi.apply_change',
            operationClass: 'apply',
            traceId,
            toolVersion: versions.toolVersion,
            contractVersion: versions.contractVersion,
            timestamp: new Date().toISOString(),
          },
          policy: {
            operationClass: 'apply',
            defaultTimeoutMs: 30_000,
            maxTimeoutMs: 120_000,
            retryPolicy: { maxAttempts: 1, initialIntervalSeconds: 1, backoffCoefficient: 1 },
            idempotency: 'required',
            mode: 'start',
          },
          error: {
            code: 'APPROVAL_REQUIRED',
            category: 'authorization',
            retriable: false,
            source: 'cli.mcp.wrapper',
            traceId,
            message: 'Approval evidence is required before apply operations.',
            details: {
              missingFields: approvalValidation.missingFields,
              maxSlaMinutes: approvalMaxSlaMinutes,
            },
          },
        },
      };
    }
  }

  const expectedPlanFingerprint = computePlanFingerprint(input);
  if (input.planFingerprint !== expectedPlanFingerprint) {
    return {
      envelope: {
        success: false,
        metadata: {
          toolId: 'golden.shinobi.apply_change',
          operationClass: 'apply',
          traceId,
          toolVersion: versions.toolVersion,
          contractVersion: versions.contractVersion,
          timestamp: new Date().toISOString(),
        },
        policy: {
          operationClass: 'apply',
          defaultTimeoutMs: 30_000,
          maxTimeoutMs: 120_000,
          retryPolicy: { maxAttempts: 1, initialIntervalSeconds: 1, backoffCoefficient: 1 },
          idempotency: 'required',
          mode: 'start',
        },
        error: {
          code: 'CONFLICT',
          category: 'conflict',
          retriable: false,
          source: 'cli.mcp.wrapper',
          traceId,
          message: 'planFingerprint mismatch. Re-run plan before apply.',
        },
      },
    };
  }

  if (!hasApplyWiring()) {
    return {
      envelope: {
        success: false,
        metadata: {
          toolId: 'golden.shinobi.apply_change',
          operationClass: 'apply',
          traceId,
          toolVersion: versions.toolVersion,
          contractVersion: versions.contractVersion,
          timestamp: new Date().toISOString(),
        },
        policy: {
          operationClass: 'apply',
          defaultTimeoutMs: 30_000,
          maxTimeoutMs: 120_000,
          retryPolicy: { maxAttempts: 1, initialIntervalSeconds: 1, backoffCoefficient: 1 },
          idempotency: 'required',
          mode: 'start',
        },
        error: {
          code: 'DEPENDENCY_UNAVAILABLE',
          category: 'upstream',
          retriable: true,
          retriableReason: 'dependency_unavailable',
          source: 'cli.mcp.wrapper',
          traceId,
          message: 'Harmony wiring is incomplete. Apply remains blocked while read/plan continue.',
        },
      },
    };
  }

  const mode = input.mode ?? defaultMode;
  if (mode === 'start') {
    try {
      const dispatch = await workflowClient.dispatchApplyWorkflow({
        traceId,
        toolId: 'golden.shinobi.apply_change',
        manifestPath: normalizeManifestPath(input.manifestPath),
        policyPack: input.policyPack,
        region: input.region,
        codePath: input.codePath,
        planFingerprint: input.planFingerprint,
        idempotencyKey: input.idempotencyKey,
      });

      return {
        envelope: {
          success: true,
          metadata: {
            toolId: 'golden.shinobi.apply_change',
            operationClass: 'apply',
            traceId,
            toolVersion: versions.toolVersion,
            contractVersion: versions.contractVersion,
            timestamp: new Date().toISOString(),
          },
          policy: {
            operationClass: 'apply',
            defaultTimeoutMs: 30_000,
            maxTimeoutMs: 120_000,
            retryPolicy: { maxAttempts: 1, initialIntervalSeconds: 1, backoffCoefficient: 1 },
            idempotency: 'required',
            mode: 'start',
          },
          data: {
            accepted: true,
            planFingerprint: input.planFingerprint,
            idempotencyKey: input.idempotencyKey,
          },
        },
        handle: createAsyncOperationHandle({
          operationId: dispatch.operationId,
          workflowId: dispatch.workflowId,
          traceId,
          submittedAt: dispatch.submittedAt,
          statusUrl: dispatch.statusUrl,
          cancelUrl: dispatch.cancelUrl,
        }),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        envelope: {
          success: false,
          metadata: {
            toolId: 'golden.shinobi.apply_change',
            operationClass: 'apply',
            traceId,
            toolVersion: versions.toolVersion,
            contractVersion: versions.contractVersion,
            timestamp: new Date().toISOString(),
          },
          policy: {
            operationClass: 'apply',
            defaultTimeoutMs: 30_000,
            maxTimeoutMs: 120_000,
            retryPolicy: { maxAttempts: 1, initialIntervalSeconds: 1, backoffCoefficient: 1 },
            idempotency: 'required',
            mode: 'start',
          },
          error: {
            code: 'DEPENDENCY_UNAVAILABLE',
            category: 'upstream',
            retriable: true,
            retriableReason: 'dependency_unavailable',
            source: 'cli.mcp.wrapper',
            traceId,
            message: `Workflow dispatch failed: ${message}`,
          },
        },
      };
    }
  }

  const result = await up({
    manifestPath: normalizeManifestPath(input.manifestPath),
    region: input.region,
    codePath: input.codePath,
    policyPack: input.policyPack,
    dryRun: false,
    json: true,
  });
  return {
    envelope: envelopeUpResult(result, {
      toolId: 'golden.shinobi.apply_change',
      operationClass: 'apply',
      traceId,
      ...versions,
    }),
  };
}

async function runReadProjection(
  toolId: 'golden.shinobi.read_entities' | 'golden.shinobi.read_activity',
  input: ReadInput,
  traceId: string,
  versions: { toolVersion: string; contractVersion: string },
): Promise<HarmonyToolCallResult> {
  const validateResult = validate({
    manifestPath: normalizeManifestPath(input.manifestPath),
    policyPack: input.policyPack,
    json: true,
  });
  const planResult = plan({
    manifestPath: normalizeManifestPath(input.manifestPath),
    policyPack: input.policyPack,
    json: true,
  });

  const derivedPayload = toolId === 'golden.shinobi.read_entities'
    ? {
      manifest: validateResult.manifest,
      resources: planResult.plan?.resources.map((resource) => ({
        name: resource.name,
        type: resource.resourceType,
      })) ?? [],
    }
    : {
      diagnostics: [
        ...(validateResult.errors.map((error) => ({ source: error.path, message: error.message }))),
        ...(planResult.errors.map((error) => ({ source: error.path, message: error.message }))),
      ],
      policy: validateResult.policy,
    };

  const readSuccess = validateResult.success && planResult.success;
  return {
    envelope: {
      success: readSuccess,
      metadata: {
        toolId,
        operationClass: 'read',
        traceId,
        toolVersion: versions.toolVersion,
        contractVersion: versions.contractVersion,
        timestamp: new Date().toISOString(),
      },
      policy: {
        operationClass: 'read',
        defaultTimeoutMs: 5_000,
        maxTimeoutMs: 15_000,
        retryPolicy: { maxAttempts: 2, initialIntervalSeconds: 1, backoffCoefficient: 2 },
        idempotency: 'recommended',
        mode: 'await',
      },
      ...(readSuccess
        ? { data: derivedPayload }
        : {
          error: {
            code: 'INPUT_VALIDATION_FAILED',
            category: 'validation',
            retriable: false,
            source: 'cli.mcp.wrapper',
            traceId,
            message: 'Read projection failed because validate/plan did not succeed.',
            details: derivedPayload as Record<string, unknown>,
          },
        }),
    },
  };
}

async function runRollback(
  traceId: string,
  versions: { toolVersion: string; contractVersion: string },
): Promise<HarmonyToolCallResult> {
  return {
    envelope: {
      success: false,
      metadata: {
        toolId: 'golden.shinobi.rollback_change',
        operationClass: 'apply',
        traceId,
        toolVersion: versions.toolVersion,
        contractVersion: versions.contractVersion,
        timestamp: new Date().toISOString(),
      },
      policy: {
        operationClass: 'apply',
        defaultTimeoutMs: 30_000,
        maxTimeoutMs: 120_000,
        retryPolicy: { maxAttempts: 1, initialIntervalSeconds: 1, backoffCoefficient: 1 },
        idempotency: 'required',
        mode: 'start',
      },
      error: {
        code: 'RUNNER_ERROR',
        category: 'runtime',
        retriable: false,
        source: 'cli.mcp.wrapper',
        traceId,
        message: 'Rollback is not yet a first-class Shinobi operation. Use wrapper-managed compensation.',
      },
    },
  };
}
