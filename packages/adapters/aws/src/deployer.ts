import * as automation from '@pulumi/pulumi/automation';
import type { ResourcePlan } from './program-generator';
import type { AdapterConfig } from './types';
import { createPulumiProgram } from './pulumi-program';

// ── Error classification ────────────────────────────────────────────────────
// Moved to deployer-errors.ts so error handling never drags in Pulumi.
export { classifyError } from './deployer-errors';
export type { DeployerError, DeployerErrorCategory } from './deployer-errors';
import { classifyError } from './deployer-errors';
import type { DeployerError } from './deployer-errors';

// ── Progress events ─────────────────────────────────────────────────────────

export type DeployerEvent =
  | { type: 'stack-creating'; stackName: string }
  | { type: 'stack-configuring'; stackName: string }
  | { type: 'deploying'; stackName: string }
  | { type: 'previewing'; stackName: string }
  | { type: 'destroying'; stackName: string }
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

export interface DestroyResult {
  readonly success: boolean;
  readonly stackName: string;
  readonly summary: {
    readonly resourceChanges?: Readonly<Record<string, number>>;
  };
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

function buildStackName(
  config: AdapterConfig,
  options?: DeployOptions,
): string {
  if (options?.stackName) return options.stackName;
  return config.environment
    ? `${config.serviceName}-${config.environment}-${config.region}`
    : `${config.serviceName}-${config.region}`;
}

function buildProjectName(
  config: AdapterConfig,
  options?: DeployOptions,
): string {
  return options?.projectName ?? config.serviceName;
}

/**
 * Builds LocalWorkspace options from the adapter config so the state
 * backend, secrets provider, and PULUMI_HOME are explicit configuration
 * rather than ambient machine state (EE-4).
 */
function buildWorkspaceOptions(
  config: AdapterConfig,
  projectName: string,
): automation.LocalWorkspaceOptions {
  const opts: {
    secretsProvider?: string;
    pulumiHome?: string;
    projectSettings?: automation.ProjectSettings;
  } = {};

  if (config.secretsProvider) opts.secretsProvider = config.secretsProvider;
  if (config.pulumiHome) opts.pulumiHome = config.pulumiHome;
  if (config.backendUrl) {
    opts.projectSettings = {
      name: projectName,
      runtime: 'nodejs',
      backend: { url: config.backendUrl },
    };
  }

  return opts;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Operation timed out')),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
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

    const stack = await automation.LocalWorkspace.createOrSelectStack(
      {
        stackName,
        projectName,
        program: createPulumiProgram(plan, config),
      },
      buildWorkspaceOptions(config, projectName),
    );

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

    const stack = await automation.LocalWorkspace.createOrSelectStack(
      {
        stackName,
        projectName,
        program: createPulumiProgram(plan, config),
      },
      buildWorkspaceOptions(config, projectName),
    );

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

// ── Destroy ─────────────────────────────────────────────────────────────────

/**
 * Tears down the stack for the given adapter config (EE-1/EE-2).
 * Selects the same stack identity used by deploy/preview; the inline
 * program is a no-op because destroy only needs the recorded state.
 */
export async function destroy(
  config: AdapterConfig,
  options?: DeployOptions,
): Promise<DestroyResult> {
  const stackName = buildStackName(config, options);
  const projectName = buildProjectName(config, options);

  try {
    options?.onEvent?.({ type: 'stack-creating', stackName });

    const stack = await automation.LocalWorkspace.createOrSelectStack(
      {
        stackName,
        projectName,
        program: async () => ({}),
      },
      buildWorkspaceOptions(config, projectName),
    );

    options?.onEvent?.({ type: 'stack-configuring', stackName });
    await stack.setConfig('aws:region', { value: config.region });

    options?.onEvent?.({ type: 'destroying', stackName });

    const destroyPromise = stack.destroy({ onOutput: options?.onOutput });
    const result = options?.timeoutMs
      ? await withTimeout(destroyPromise, options.timeoutMs)
      : await destroyPromise;

    options?.onEvent?.({ type: 'complete', stackName });

    return {
      success: true,
      stackName,
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
      summary: {},
      error: err instanceof Error ? err.message : String(err),
      errorDetail,
    };
  }
}
