import * as automation from '@pulumi/pulumi/automation';
import type { ResourcePlan } from './program-generator';
import type { AdapterConfig } from './types';
import { createPulumiProgram } from './pulumi-program';

// ── Error classification ────────────────────────────────────────────────────

export type DeployerErrorCategory =
  | 'pulumi-runtime'
  | 'aws-credentials'
  | 'stack-conflict'
  | 'timeout'
  | 'unknown';

export interface DeployerError {
  readonly code:
    | 'AUTH_FAILURE'
    | 'CONFLICT'
    | 'UPSTREAM_TIMEOUT'
    | 'RUNNER_ERROR'
    | 'UPSTREAM_UNAVAILABLE';
  readonly category: DeployerErrorCategory;
  readonly source: 'adapter-aws.deployer';
  readonly message: string;
  readonly originalError?: Error;
  readonly retryable: boolean;
  readonly retriableReason?:
    | 'rate_limit'
    | 'upstream_timeout'
    | 'upstream_5xx'
    | 'transport_unavailable'
    | 'worker_unavailable'
    | 'dependency_unavailable';
}

export function classifyError(err: unknown): DeployerError {
  const message = err instanceof Error ? err.message : String(err);
  const originalError = err instanceof Error ? err : undefined;

  if (/NoCredentialProviders|ExpiredToken|InvalidClientTokenId|security token/i.test(message)) {
    return {
      code: 'AUTH_FAILURE',
      category: 'aws-credentials',
      source: 'adapter-aws.deployer',
      message,
      originalError,
      retryable: false,
    };
  }

  if (/conflict|already being updated|UPDATE_IN_PROGRESS/i.test(message)) {
    return {
      code: 'CONFLICT',
      category: 'stack-conflict',
      source: 'adapter-aws.deployer',
      message,
      originalError,
      retryable: false,
    };
  }

  if (/timed? ?out/i.test(message)) {
    return {
      code: 'UPSTREAM_TIMEOUT',
      category: 'timeout',
      source: 'adapter-aws.deployer',
      message,
      originalError,
      retryable: true,
      retriableReason: 'upstream_timeout',
    };
  }

  if (/rate.?limit|too many requests|429/i.test(message)) {
    return {
      code: 'RATE_LIMIT',
      category: 'unknown',
      source: 'adapter-aws.deployer',
      message,
      originalError,
      retryable: true,
      retriableReason: 'rate_limit',
    };
  }

  if (/pulumi|failed to load plugin|no Pulumi project/i.test(message)) {
    return {
      code: 'RUNNER_ERROR',
      category: 'pulumi-runtime',
      source: 'adapter-aws.deployer',
      message,
      originalError,
      retryable: false,
    };
  }

  return {
    code: 'UPSTREAM_UNAVAILABLE',
    category: 'unknown',
    source: 'adapter-aws.deployer',
    message,
    originalError,
    retryable: true,
    retriableReason: 'dependency_unavailable',
  };
}

// ── Progress events ─────────────────────────────────────────────────────────

export type DeployerEvent =
  | { type: 'stack-creating'; stackName: string }
  | { type: 'stack-configuring'; stackName: string }
  | { type: 'deploying'; stackName: string }
  | { type: 'previewing'; stackName: string }
  | { type: 'complete'; stackName: string }
  | { type: 'error'; stackName: string; error: DeployerError };

// ── Result types ────────────────────────────────────────────────────────────

export interface DeployResult {
  readonly success: boolean;
  readonly stackName: string;
  readonly outputs: Readonly<Record<string, unknown>>;
  readonly summary: {
    readonly resourceChanges?: Readonly<Record<string, number>>;
  };
  readonly error?: string;
  readonly errorDetail?: DeployerError;
}

export interface PreviewResult {
  readonly success: boolean;
  readonly stackName: string;
  readonly changeSummary?: Readonly<Record<string, number>>;
  readonly error?: string;
  readonly errorDetail?: DeployerError;
}

// ── Options ─────────────────────────────────────────────────────────────────

export interface DeployOptions {
  readonly stackName?: string;
  readonly projectName?: string;
  readonly onOutput?: (out: string) => void;
  readonly onEvent?: (event: DeployerEvent) => void;
  readonly timeoutMs?: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildStackName(config: AdapterConfig, options?: DeployOptions): string {
  return options?.stackName ?? `${config.serviceName}-${config.region}`;
}

function buildProjectName(config: AdapterConfig, options?: DeployOptions): string {
  return options?.projectName ?? config.serviceName;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Operation timed out')), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

// ── Deploy ──────────────────────────────────────────────────────────────────

export async function deploy(
  plan: ResourcePlan,
  config: AdapterConfig,
  options?: DeployOptions,
): Promise<DeployResult> {
  const stackName = buildStackName(config, options);
  const projectName = buildProjectName(config, options);

  try {
    options?.onEvent?.({ type: 'stack-creating', stackName });

    const stack = await automation.LocalWorkspace.createOrSelectStack({
      stackName,
      projectName,
      program: createPulumiProgram(plan, config),
    });

    options?.onEvent?.({ type: 'stack-configuring', stackName });
    await stack.setConfig('aws:region', { value: config.region });

    options?.onEvent?.({ type: 'deploying', stackName });

    const upPromise = stack.up({ onOutput: options?.onOutput });
    const result = options?.timeoutMs
      ? await withTimeout(upPromise, options.timeoutMs)
      : await upPromise;

    const outputs: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(result.outputs)) {
      outputs[key] = val.value;
    }

    options?.onEvent?.({ type: 'complete', stackName });

    return {
      success: true,
      stackName,
      outputs,
      summary: {
        resourceChanges: result.summary.resourceChanges,
      },
    };
  } catch (err) {
    const errorDetail = classifyError(err);
    options?.onEvent?.({ type: 'error', stackName, error: errorDetail });

    return {
      success: false,
      stackName,
      outputs: {},
      summary: {},
      error: err instanceof Error ? err.message : String(err),
      errorDetail,
    };
  }
}

// ── Preview ─────────────────────────────────────────────────────────────────

export async function preview(
  plan: ResourcePlan,
  config: AdapterConfig,
  options?: DeployOptions,
): Promise<PreviewResult> {
  const stackName = buildStackName(config, options);
  const projectName = buildProjectName(config, options);

  try {
    options?.onEvent?.({ type: 'stack-creating', stackName });

    const stack = await automation.LocalWorkspace.createOrSelectStack({
      stackName,
      projectName,
      program: createPulumiProgram(plan, config),
    });

    options?.onEvent?.({ type: 'stack-configuring', stackName });
    await stack.setConfig('aws:region', { value: config.region });

    options?.onEvent?.({ type: 'previewing', stackName });

    const previewPromise = stack.preview({ onOutput: options?.onOutput });
    const result = options?.timeoutMs
      ? await withTimeout(previewPromise, options.timeoutMs)
      : await previewPromise;

    options?.onEvent?.({ type: 'complete', stackName });

    return {
      success: true,
      stackName,
      changeSummary: result.changeSummary,
    };
  } catch (err) {
    const errorDetail = classifyError(err);
    options?.onEvent?.({ type: 'error', stackName, error: errorDetail });

    return {
      success: false,
      stackName,
      error: err instanceof Error ? err.message : String(err),
      errorDetail,
    };
  }
}
