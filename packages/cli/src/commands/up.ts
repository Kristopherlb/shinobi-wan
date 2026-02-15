import { plan } from './plan';
import type { PlanOptions, PlanResult } from './plan';
import { deploy, preview } from '@shinobi/adapter-aws';
import type { DeployResult, PreviewResult, AdapterConfig } from '@shinobi/adapter-aws';

export interface UpOptions extends PlanOptions {
  readonly dryRun?: boolean;
}

export interface UpResult {
  readonly success: boolean;
  readonly plan: PlanResult;
  readonly deployed: boolean;
  readonly message: string;
  readonly deployResult?: DeployResult;
  readonly previewResult?: PreviewResult;
}

/**
 * Runs the up command: validate → plan → deploy.
 *
 * Default mode is dry run (calls Pulumi preview).
 * Pass `dryRun: false` to actually deploy via Pulumi Automation API.
 */
export async function up(options: UpOptions): Promise<UpResult> {
  const planResult = plan(options);

  if (!planResult.success || !planResult.plan) {
    return {
      success: false,
      plan: planResult,
      deployed: false,
      message: 'Plan failed. Fix errors before deploying.',
    };
  }

  const adapterConfig: AdapterConfig = {
    region: options.region ?? 'us-east-1',
    serviceName: planResult.validation.manifest?.service ?? 'shinobi-service',
    ...(options.codePath ? { codePath: options.codePath } : {}),
  };

  if (options.dryRun !== false) {
    // Dry run: call Pulumi preview for a real dry-run
    const previewResult = await preview(planResult.plan, adapterConfig);

    if (!previewResult.success) {
      return {
        success: false,
        plan: planResult,
        deployed: false,
        message: `Preview failed: ${previewResult.error}`,
        previewResult,
      };
    }

    const changes = previewResult.changeSummary ?? {};
    const createCount = changes['create'] ?? 0;

    return {
      success: true,
      plan: planResult,
      deployed: false,
      message: `Preview complete. ${createCount} resources would be created. Use --no-dry-run to deploy.`,
      previewResult,
    };
  }

  // Actual deployment via Pulumi Automation API
  const deployResult = await deploy(planResult.plan, adapterConfig, {
    onOutput: (out: string) => process.stdout.write(out),
  });

  if (!deployResult.success) {
    return {
      success: false,
      plan: planResult,
      deployed: false,
      message: `Deployment failed: ${deployResult.error}`,
      deployResult,
    };
  }

  const created = deployResult.summary.resourceChanges?.['create'] ?? 0;

  return {
    success: true,
    plan: planResult,
    deployed: true,
    message: `Deployed ${created} resources to stack '${deployResult.stackName}'.`,
    deployResult,
  };
}
