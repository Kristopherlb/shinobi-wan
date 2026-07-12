import * as fs from 'fs';
import { parseManifest, manifestToMutations } from '../manifest';
import { Kernel, explainCompilation } from '@shinobi/kernel';
import type { WhyReport } from '@shinobi/kernel';
import type {
  IBinder,
  IPolicyEvaluator,
  CompilationResult,
} from '@shinobi/kernel';
import {
  ComponentPlatformBinder,
  TriggersBinder,
  DependsOnBinder,
  BinderRegistry,
} from '@shinobi/binder';
import { BaselinePolicyEvaluator } from '@shinobi/policy';

export interface ValidateOptions {
  readonly manifestPath: string;
  readonly json?: boolean;
  readonly policyPack?: string;
  /** Named environment (dev/staging/prod); exposed to binders/evaluators via resolvedConfig and used for stack naming downstream (EE-5) */
  readonly environment?: string;
  /** Environment variables for ${env:KEY} interpolation in config layers. Injected explicitly — the kernel never reads process.env (KL-007). */
  readonly envVars?: Readonly<Record<string, string>>;
  /** Evaluation date (YYYY-MM-DD) for policy-exception expiry; defaults to today. Inject a fixed date for reproducible runs. */
  readonly evaluationDate?: string;
  /** Include a why-report (KL-006) tracing intents, diagnostics, and violations to their causes */
  readonly explain?: boolean;
  /** Custom binders; defaults to the built-in registry (no-fork extension point) */
  readonly binders?: ReadonlyArray<IBinder>;
  /** Custom policy evaluators; defaults to BaselinePolicyEvaluator */
  readonly evaluators?: ReadonlyArray<IPolicyEvaluator>;
}

export interface ValidateResult {
  readonly success: boolean;
  readonly manifest?: { service: string; components: number; bindings: number };
  readonly validation?: {
    valid: boolean;
    errorCount: number;
    warningCount: number;
  };
  readonly bindingDiagnostics?: ReadonlyArray<{
    path: string;
    rule: string;
    message: string;
    severity: string;
  }>;
  readonly policy?: {
    policyPack: string;
    compliant: boolean;
    violationCount: number;
    blockingViolationCount: number;
    advisoryViolationCount: number;
  };
  readonly compilation?: CompilationResult;
  /** Present when options.explain is set: causal why-report (KL-006) */
  readonly why?: WhyReport;
  readonly errors: ReadonlyArray<{ path: string; message: string }>;
}

function createBinders(): ReadonlyArray<IBinder> {
  const registry = new BinderRegistry();
  registry.register(new ComponentPlatformBinder());
  registry.register(new TriggersBinder());
  registry.register(new DependsOnBinder());
  return registry.getBinders();
}

function createEvaluators(): ReadonlyArray<IPolicyEvaluator> {
  return [new BaselinePolicyEvaluator()];
}

/**
 * Runs the validate command: parse manifest → compile → report results.
 */
export function validate(options: ValidateOptions): ValidateResult {
  // Read manifest file
  let yamlContent: string;
  try {
    yamlContent = fs.readFileSync(options.manifestPath, 'utf-8');
  } catch (e) {
    return {
      success: false,
      errors: [
        {
          path: options.manifestPath,
          message: `Cannot read file: ${(e as Error).message}`,
        },
      ],
    };
  }

  // Parse manifest
  const parseResult = parseManifest(yamlContent);
  if (!parseResult.ok) {
    return {
      success: false,
      errors: parseResult.errors,
    };
  }

  const manifest = parseResult.manifest;
  const mutations = manifestToMutations(manifest);

  // Create kernel with binders and evaluators
  const kernel = new Kernel({
    binders: options.binders ?? createBinders(),
    evaluators: options.evaluators ?? createEvaluators(),
    config: {
      ...(options.policyPack || manifest.policyPack
        ? { policyPack: options.policyPack ?? manifest.policyPack }
        : {}),
      layers: [
        ...(options.environment
          ? [
              {
                source: 'environment' as const,
                values: { environment: options.environment },
              },
            ]
          : []),
        ...(manifest.exceptions && manifest.exceptions.length > 0
          ? [
              {
                source: 'overrides' as const,
                values: {
                  exceptions: manifest.exceptions,
                  // The engine never reads the clock; the CLI injects today
                  // as the evaluation date for exception expiry (Standard 5).
                  evaluationDate:
                    options.evaluationDate ??
                    new Date().toISOString().slice(0, 10),
                },
              },
            ]
          : []),
      ],
      ...(options.envVars ? { environment: options.envVars } : {}),
    },
  });

  // Apply mutations
  const mutResult = kernel.applyMutation(mutations);
  if (!mutResult.success) {
    return {
      success: false,
      errors: mutResult.errors.map((e) => ({
        path: 'graph',
        message: e.error.message,
      })),
    };
  }

  // Compile
  const compilation = kernel.compile();

  // Build result
  const result: ValidateResult = {
    success:
      compilation.validation.valid && (compilation.policy?.compliant ?? true),
    manifest: {
      service: manifest.service,
      components: manifest.components.length,
      bindings: manifest.bindings.length,
    },
    validation: {
      valid: compilation.validation.valid,
      errorCount: compilation.validation.errors.filter(
        (e) => e.severity === 'error',
      ).length,
      warningCount: compilation.validation.errors.filter(
        (e) => e.severity === 'warning',
      ).length,
    },
    ...(compilation.bindingDiagnostics.length > 0
      ? {
          bindingDiagnostics: compilation.bindingDiagnostics.map((d) => ({
            path: d.path,
            rule: d.rule,
            message: d.message,
            severity: d.severity,
          })),
        }
      : {}),
    ...(compilation.policy
      ? {
          policy: {
            policyPack: compilation.policy.policyPack,
            compliant: compilation.policy.compliant,
            violationCount: compilation.policy.violations.length,
            blockingViolationCount: compilation.policy.violations.filter(
              (v) => v.severity === 'error',
            ).length,
            advisoryViolationCount: compilation.policy.violations.filter(
              (v) => v.severity !== 'error',
            ).length,
          },
        }
      : {}),
    compilation,
    ...(options.explain ? { why: explainCompilation(compilation) } : {}),
    errors: [],
  };

  return result;
}
