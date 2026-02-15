import * as automation from '@pulumi/pulumi/automation';
import type { ResourcePlan } from './program-generator';
import type { AdapterConfig } from './types';
import { createPulumiProgram } from './pulumi-program';

/**
 * Result of a deployment operation.
 */
export interface DeployResult {
  readonly success: boolean;
  readonly stackName: string;
  readonly outputs: Readonly<Record<string, unknown>>;
  readonly summary: {
    readonly resourceChanges?: Readonly<Record<string, number>>;
  };
  readonly error?: string;
}

/**
 * Result of a preview (dry-run) operation.
 */
export interface PreviewResult {
  readonly success: boolean;
  readonly stackName: string;
  readonly changeSummary?: Readonly<Record<string, number>>;
  readonly error?: string;
}

/**
 * Options for deploy/preview operations.
 */
export interface DeployOptions {
  readonly stackName?: string;
  readonly projectName?: string;
  readonly onOutput?: (out: string) => void;
}

function buildStackName(config: AdapterConfig, options?: DeployOptions): string {
  return options?.stackName ?? `${config.serviceName}-${config.region}`;
}

function buildProjectName(config: AdapterConfig, options?: DeployOptions): string {
  return options?.projectName ?? config.serviceName;
}

/**
 * Deploys resources using the Pulumi Automation API.
 *
 * 1. Creates a LocalWorkspace with the inline program
 * 2. Creates/selects the stack
 * 3. Sets AWS region config
 * 4. Runs `stack.up()`
 * 5. Returns structured result with outputs
 */
export async function deploy(
  plan: ResourcePlan,
  config: AdapterConfig,
  options?: DeployOptions,
): Promise<DeployResult> {
  const stackName = buildStackName(config, options);
  const projectName = buildProjectName(config, options);

  try {
    const stack = await automation.LocalWorkspace.createOrSelectStack({
      stackName,
      projectName,
      program: createPulumiProgram(plan, config),
    });

    // Set AWS region
    await stack.setConfig('aws:region', { value: config.region });

    const result = await stack.up({
      onOutput: options?.onOutput,
    });

    const outputs: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(result.outputs)) {
      outputs[key] = val.value;
    }

    return {
      success: true,
      stackName,
      outputs,
      summary: {
        resourceChanges: result.summary.resourceChanges,
      },
    };
  } catch (err) {
    return {
      success: false,
      stackName,
      outputs: {},
      summary: {},
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Previews a deployment using the Pulumi Automation API (dry-run).
 *
 * Same setup as deploy, but calls `stack.preview()` instead of `stack.up()`.
 */
export async function preview(
  plan: ResourcePlan,
  config: AdapterConfig,
  options?: DeployOptions,
): Promise<PreviewResult> {
  const stackName = buildStackName(config, options);
  const projectName = buildProjectName(config, options);

  try {
    const stack = await automation.LocalWorkspace.createOrSelectStack({
      stackName,
      projectName,
      program: createPulumiProgram(plan, config),
    });

    // Set AWS region
    await stack.setConfig('aws:region', { value: config.region });

    const result = await stack.preview({
      onOutput: options?.onOutput,
    });

    return {
      success: true,
      stackName,
      changeSummary: result.changeSummary,
    };
  } catch (err) {
    return {
      success: false,
      stackName,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
