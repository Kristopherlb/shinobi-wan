import type { PlanResult } from '../commands/plan';
import type { UpResult } from '../commands/up';
import type { ValidateResult } from '../commands/validate';
import { getOperationPolicy } from './policy';
import type {
  OperationClass,
  RetriableReason,
  ToolErrorEnvelope,
  ToolResponseEnvelope,
} from './types';

export interface EnvelopeOptions {
  readonly toolId: string;
  readonly operationClass: OperationClass;
  readonly traceId: string;
  readonly toolVersion: string;
  readonly contractVersion: string;
}

function buildErrorEnvelope(
  code: string,
  source: string,
  message: string,
  traceId: string,
  retriable = false,
  retriableReason?: RetriableReason,
  details?: Readonly<Record<string, unknown>>,
): ToolErrorEnvelope {
  const category = code === 'INPUT_VALIDATION_FAILED'
    ? 'validation'
    : code === 'UNAUTHORIZED' || code === 'APPROVAL_REQUIRED'
      ? 'authorization'
      : code === 'CONFLICT'
        ? 'conflict'
        : code.includes('UPSTREAM') || code === 'AUTH_FAILURE'
          ? 'upstream'
          : code === 'RUNNER_ERROR'
            ? 'runtime'
            : 'unknown';

  if (retriable && !retriableReason) {
    throw new Error(`retriableReason is required when retriable=true for code '${code}'`);
  }

  const base = {
    code,
    category,
    source,
    traceId,
    message,
    ...(details ? { details } : {}),
  };

  if (retriable) {
    return {
      ...base,
      retriable: true,
      retriableReason: retriableReason!,
    };
  }

  return {
    ...base,
    retriable: false,
  };
}

function buildEnvelope<T>(
  options: EnvelopeOptions,
  success: boolean,
  data?: T,
  error?: ToolErrorEnvelope,
): ToolResponseEnvelope<T> {
  return {
    success,
    metadata: {
      toolId: options.toolId,
      toolVersion: options.toolVersion,
      contractVersion: options.contractVersion,
      operationClass: options.operationClass,
      traceId: options.traceId,
      timestamp: new Date().toISOString(),
    },
    policy: getOperationPolicy(options.operationClass),
    ...(data ? { data } : {}),
    ...(error ? { error } : {}),
  };
}

export function envelopeValidateResult(
  result: ValidateResult,
  options: EnvelopeOptions,
): ToolResponseEnvelope<ValidateResult> {
  if (result.success) {
    return buildEnvelope(options, true, result);
  }

  const firstError = result.errors[0];
  return buildEnvelope(
    options,
    false,
    undefined,
    buildErrorEnvelope(
      'INPUT_VALIDATION_FAILED',
      'cli.validate',
      firstError?.message ?? 'Validation failed',
      options.traceId,
      false,
      undefined,
      firstError ? { path: firstError.path } : undefined,
    ),
  );
}

export function envelopePlanResult(
  result: PlanResult,
  options: EnvelopeOptions,
): ToolResponseEnvelope<PlanResult> {
  if (result.success) {
    return buildEnvelope(options, true, result);
  }

  const firstError = result.errors[0];
  return buildEnvelope(
    options,
    false,
    undefined,
    buildErrorEnvelope(
      'INPUT_VALIDATION_FAILED',
      'cli.plan',
      firstError?.message ?? 'Plan failed',
      options.traceId,
      false,
      undefined,
      firstError ? { path: firstError.path } : undefined,
    ),
  );
}

export function envelopeUpResult(
  result: UpResult,
  options: EnvelopeOptions,
): ToolResponseEnvelope<UpResult> {
  if (result.success) {
    return buildEnvelope(options, true, result);
  }

  const deployError = result.deployResult?.errorDetail;
  if (deployError) {
    return buildEnvelope(
      options,
      false,
      undefined,
      buildErrorEnvelope(
        deployError.code,
        deployError.source,
        deployError.message,
        options.traceId,
        deployError.retryable,
        deployError.retriableReason,
        { category: deployError.category },
      ),
    );
  }

  const isPreviewFailure = result.message.startsWith('Preview failed');
  return buildEnvelope(
    options,
    false,
    undefined,
    buildErrorEnvelope(
      isPreviewFailure ? 'UPSTREAM_UNAVAILABLE' : 'RUNNER_ERROR',
      'cli.up',
      result.message,
      options.traceId,
      isPreviewFailure,
      isPreviewFailure ? 'transport_unavailable' : undefined,
    ),
  );
}
