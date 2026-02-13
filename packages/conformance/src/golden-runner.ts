import type { GraphMutation } from '@shinobi/ir';
import { Kernel } from '@shinobi/kernel';
import type { KernelConfig, IBinder, IPolicyEvaluator } from '@shinobi/kernel';
import type { GoldenResult } from './types';

/**
 * Options for running a golden case.
 */
export interface RunGoldenCaseOptions {
  /** Function that returns the graph mutations to apply */
  readonly setup: () => ReadonlyArray<GraphMutation>;
  /** Kernel configuration */
  readonly config?: KernelConfig;
  /** Binder implementations */
  readonly binders?: ReadonlyArray<IBinder>;
  /** Policy evaluator implementations */
  readonly evaluators?: ReadonlyArray<IPolicyEvaluator>;
}

/**
 * Runs a golden case through the full compilation pipeline.
 *
 * 1. Creates a Kernel with provided binders, evaluators, and config
 * 2. Applies the graph mutations from the setup function
 * 3. Calls kernel.compile()
 * 4. Returns { compilation, serialized } for snapshot comparison
 */
export function runGoldenCase(options: RunGoldenCaseOptions): GoldenResult {
  const kernel = new Kernel({
    config: options.config,
    binders: options.binders,
    evaluators: options.evaluators,
  });

  const mutations = options.setup();
  kernel.applyMutation(mutations);

  const compilation = kernel.compile();
  const serialized = JSON.stringify(compilation);

  return { compilation, serialized };
}
