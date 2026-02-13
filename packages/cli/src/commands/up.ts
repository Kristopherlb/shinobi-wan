import { plan } from './plan';
import type { PlanOptions, PlanResult } from './plan';

export interface UpOptions extends PlanOptions {
  readonly dryRun?: boolean;
}

export interface UpResult {
  readonly success: boolean;
  readonly plan: PlanResult;
  readonly deployed: boolean;
  readonly message: string;
}

/**
 * Runs the up command: validate → plan → deploy.
 *
 * For MVP, this generates the plan and reports what would be deployed.
 * Actual Pulumi deployment requires the Pulumi CLI and is gated behind
 * the `dryRun` flag (default: true for safety).
 */
export function up(options: UpOptions): UpResult {
  const planResult = plan(options);

  if (!planResult.success || !planResult.plan) {
    return {
      success: false,
      plan: planResult,
      deployed: false,
      message: 'Plan failed. Fix errors before deploying.',
    };
  }

  if (options.dryRun !== false) {
    return {
      success: true,
      plan: planResult,
      deployed: false,
      message: `Dry run complete. ${planResult.plan.resources.length} resources would be created. Use --no-dry-run to deploy.`,
    };
  }

  // Actual deployment would use Pulumi automation API here.
  // For MVP, we return the plan with a message about manual deployment.
  return {
    success: true,
    plan: planResult,
    deployed: false,
    message: `Plan ready with ${planResult.plan.resources.length} resources. Pulumi deployment not yet wired — use the generated plan with 'pulumi up'.`,
  };
}
