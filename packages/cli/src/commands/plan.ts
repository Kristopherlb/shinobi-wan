import { validate } from './validate';
import type { ValidateResult } from './validate';
import { lower, generatePlan } from '@shinobi/adapter-aws';
import type { AdapterConfig, AdapterResult, ResourcePlan } from '@shinobi/adapter-aws';

export interface PlanOptions {
  readonly manifestPath: string;
  readonly region?: string;
  readonly codePath?: string;
  readonly json?: boolean;
}

export interface PlanResult {
  readonly success: boolean;
  readonly validation: ValidateResult;
  readonly adapter?: AdapterResult;
  readonly plan?: ResourcePlan;
  readonly errors: ReadonlyArray<{ path: string; message: string }>;
}

/**
 * Runs the plan command: validate → lower → generate plan.
 *
 * This is a dry-run that shows what resources would be created
 * without actually deploying anything.
 */
export function plan(options: PlanOptions): PlanResult {
  // Run validation first
  const validationResult = validate({ manifestPath: options.manifestPath, json: options.json });

  if (!validationResult.success || !validationResult.compilation) {
    return {
      success: false,
      validation: validationResult,
      errors: validationResult.errors,
    };
  }

  const compilation = validationResult.compilation;

  // Build adapter config
  const adapterConfig: AdapterConfig = {
    region: options.region ?? 'us-east-1',
    serviceName: validationResult.manifest?.service ?? 'shinobi-service',
    ...(options.codePath ? { codePath: options.codePath } : {}),
  };

  // Lower intents to AWS resources
  const adapterResult = lower({
    intents: compilation.intents,
    snapshot: compilation.snapshot,
    adapterConfig,
  });

  if (!adapterResult.success) {
    return {
      success: false,
      validation: validationResult,
      adapter: adapterResult,
      errors: adapterResult.diagnostics
        .filter((d) => d.severity === 'error')
        .map((d) => ({ path: d.sourceId, message: d.message })),
    };
  }

  // Generate execution plan
  const resourcePlan = generatePlan(adapterResult, adapterConfig);

  return {
    success: true,
    validation: validationResult,
    adapter: adapterResult,
    plan: resourcePlan,
    errors: [],
  };
}
