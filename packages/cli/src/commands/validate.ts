import * as fs from 'fs';
import { parseManifest, manifestToMutations } from '../manifest';
import { Kernel } from '@shinobi/kernel';
import type { IBinder, IPolicyEvaluator, CompilationResult } from '@shinobi/kernel';
import { ComponentPlatformBinder, TriggersBinder, BinderRegistry } from '@shinobi/binder';
import { BaselinePolicyEvaluator } from '@shinobi/policy';

export interface ValidateOptions {
  readonly manifestPath: string;
  readonly json?: boolean;
  readonly policyPack?: string;
}

export interface ValidateResult {
  readonly success: boolean;
  readonly manifest?: { service: string; components: number; bindings: number };
  readonly validation?: { valid: boolean; errorCount: number; warningCount: number };
  readonly policy?: { policyPack: string; compliant: boolean; violationCount: number };
  readonly compilation?: CompilationResult;
  readonly errors: ReadonlyArray<{ path: string; message: string }>;
}

function createBinders(): ReadonlyArray<IBinder> {
  const registry = new BinderRegistry();
  registry.register(new ComponentPlatformBinder());
  registry.register(new TriggersBinder());
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
      errors: [{ path: options.manifestPath, message: `Cannot read file: ${(e as Error).message}` }],
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
    binders: createBinders(),
    evaluators: createEvaluators(),
    config: (options.policyPack || manifest.policyPack)
      ? { policyPack: options.policyPack ?? manifest.policyPack }
      : {},
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
    success: compilation.validation.valid && (compilation.policy?.compliant ?? true),
    manifest: {
      service: manifest.service,
      components: manifest.components.length,
      bindings: manifest.bindings.length,
    },
    validation: {
      valid: compilation.validation.valid,
      errorCount: compilation.validation.errors.filter((e) => e.severity === 'error').length,
      warningCount: compilation.validation.errors.filter((e) => e.severity === 'warning').length,
    },
    ...(compilation.policy
      ? {
          policy: {
            policyPack: compilation.policy.policyPack,
            compliant: compilation.policy.compliant,
            violationCount: compilation.policy.violations.length,
          },
        }
      : {}),
    compilation,
    errors: [],
  };

  return result;
}
