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
  readonly category: DeployerErrorCategory;
  readonly message: string;
  readonly originalError?: Error;
  readonly retryable: boolean;
}

export function classifyError(err: unknown): DeployerError {
  const message = err instanceof Error ? err.message : String(err);
  const originalError = err instanceof Error ? err : undefined;

  if (/NoCredentialProviders|ExpiredToken|InvalidClientTokenId|security token/i.test(message)) {
    return { category: 'aws-credentials', message, originalError, retryable: false };
  }

  if (/conflict|already being updated|UPDATE_IN_PROGRESS/i.test(message)) {
    return { category: 'stack-conflict', message, originalError, retryable: true };
  }

  if (/timed? ?out/i.test(message)) {
    return { category: 'timeout', message, originalError, retryable: true };
  }

  if (/pulumi|failed to load plugin|no Pulumi project/i.test(message)) {
    return { category: 'pulumi-runtime', message, originalError, retryable: false };
  }

  return { category: 'unknown', message, originalError, retryable: false };
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
