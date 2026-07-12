import { validate } from './validate';
import type { ValidateResult } from './validate';
import { destroy as destroyStack } from '@shinobi/adapter-aws';
import type { AdapterConfig, DestroyResult } from '@shinobi/adapter-aws';

export interface DestroyOptions {
  readonly manifestPath: string;
  readonly region?: string;
  readonly environment?: string;
  readonly backendUrl?: string;
  readonly secretsProvider?: string;
  readonly json?: boolean;
  /** Default true: report the stack that would be destroyed without acting */
  readonly dryRun?: boolean;
}

export interface DestroyCommandResult {
  readonly success: boolean;
  readonly stackName: string;
  readonly destroyed: boolean;
  readonly message: string;
  readonly validation: ValidateResult;
  readonly destroyResult?: DestroyResult;
}

function buildStackName(config: AdapterConfig): string {
  return config.environment
    ? `${config.serviceName}-${config.environment}-${config.region}`
    : `${config.serviceName}-${config.region}`;
}

/**
 * Runs the destroy command: parse the manifest to identify the stack, then
 * tear it down via the Pulumi Automation API (EE-1/EE-2).
 *
 * Default mode is dry run: reports the target stack without destroying.
 * Pass `dryRun: false` to actually destroy.
 */
export async function destroy(
  options: DestroyOptions,
): Promise<DestroyCommandResult> {
  // Parse the manifest for the service name; full policy evaluation is not
  // required to tear down, but a broken manifest should still fail loudly.
  const validation = validate({ manifestPath: options.manifestPath });

  if (!validation.manifest) {
    return {
      success: false,
      stackName: '',
      destroyed: false,
      message: 'Cannot read manifest to determine the stack to destroy.',
      validation,
    };
  }

  const adapterConfig: AdapterConfig = {
    region: options.region ?? 'us-east-1',
    serviceName: validation.manifest.service,
    ...(options.environment ? { environment: options.environment } : {}),
    ...(options.backendUrl ? { backendUrl: options.backendUrl } : {}),
    ...(options.secretsProvider
      ? { secretsProvider: options.secretsProvider }
      : {}),
  };
  const stackName = buildStackName(adapterConfig);

  if (options.dryRun !== false) {
    return {
      success: true,
      stackName,
      destroyed: false,
      message: `Dry run: stack '${stackName}' would be destroyed. Use --no-dry-run to destroy.`,
      validation,
    };
  }

  const destroyResult = await destroyStack(adapterConfig, {
    onOutput: (out: string) => process.stdout.write(out),
  });

  if (!destroyResult.success) {
    return {
      success: false,
      stackName: destroyResult.stackName,
      destroyed: false,
      message: `Destroy failed: ${destroyResult.error}`,
      validation,
      destroyResult,
    };
  }

  const deleted = destroyResult.summary.resourceChanges?.['delete'] ?? 0;

  return {
    success: true,
    stackName: destroyResult.stackName,
    destroyed: true,
    message: `Destroyed ${deleted} resources from stack '${destroyResult.stackName}'.`,
    validation,
    destroyResult,
  };
}
