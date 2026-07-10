import type { Violation } from '@shinobi/contracts';
import type { PolicyEvaluationContext } from '../types';

/**
 * Interface that policy evaluator implementations must satisfy.
 *
 * Evaluators check intents and graph state against policy pack rules.
 */
export interface IPolicyEvaluator {
  /** Unique evaluator identifier */
  readonly id: string;

  /** Policy packs this evaluator handles */
  readonly supportedPacks: ReadonlyArray<string>;

  /** Evaluate the graph + intents against the requested policy pack */
  evaluate(context: PolicyEvaluationContext): ReadonlyArray<Violation>;
}
