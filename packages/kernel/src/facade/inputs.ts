/**
 * Input types for kernel facade methods.
 * mode enforces plan vs apply split for safe execution.
 */

export type FacadeMode = 'plan' | 'apply';

/** Common options for facade calls. */
export interface FacadeBaseInput {
  readonly traceId?: string;
}

/** Input for validatePlan (plan mode: validation only, no side effects). */
export interface ValidatePlanInput extends FacadeBaseInput {
  readonly mode: 'plan';
  /** Graph snapshot to validate (nodes, edges, artifacts). */
  readonly snapshot: Readonly<Record<string, unknown>>;
  readonly policyPack?: string;
}

/** Input for planChange (plan mode: compute planned change, no apply). */
export interface PlanChangeInput extends FacadeBaseInput {
  readonly mode: 'plan';
  readonly snapshot: Readonly<Record<string, unknown>>;
  readonly policyPack?: string;
}

/** Input for applyChange (apply mode: apply mutations). */
export interface ApplyChangeInput extends FacadeBaseInput {
  readonly mode: 'apply';
  readonly snapshot: Readonly<Record<string, unknown>>;
  readonly mutations?: ReadonlyArray<Readonly<Record<string, unknown>>>;
  readonly policyPack?: string;
}

/** Input for readEntities (read-only). */
export interface ReadEntitiesInput extends FacadeBaseInput {
  readonly snapshot?: Readonly<Record<string, unknown>>;
}

/** Input for readActivity (read-only). */
export interface ReadActivityInput extends FacadeBaseInput {
  readonly snapshot?: Readonly<Record<string, unknown>>;
}
