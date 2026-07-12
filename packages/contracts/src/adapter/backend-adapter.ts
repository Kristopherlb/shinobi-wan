import type { Intent } from '../intent/intent-base';

/**
 * Backend-neutral adapter configuration.
 *
 * Concrete adapters may accept additional provider-specific keys; the fields
 * here are the ones the kernel/CLI orchestration layer understands.
 */
export interface BackendAdapterConfig {
  /** Provider region or location for resource creation */
  readonly region: string;
  /** Service name used for resource naming and stack identity */
  readonly serviceName: string;
  /** Named environment (dev/staging/prod); namespaces stack identity */
  readonly environment?: string;
  /** Explicit state-backend URL (e.g. s3://..., file://...) */
  readonly backendUrl?: string;
  /** Secrets provider for stack encryption (e.g. awskms://alias/...) */
  readonly secretsProvider?: string;
  /** Additional adapter-specific configuration */
  readonly [key: string]: unknown;
}

/**
 * A structured diagnostic emitted during lowering or deployment.
 * Mirrors the shape used across kernel/binder outputs (KL-006).
 */
export interface BackendDiagnostic {
  readonly severity: 'error' | 'warning' | 'info';
  readonly message: string;
  readonly sourceId: string;
}

/**
 * Result of lowering intents + graph to provider resources.
 * `resources` is intentionally opaque here — its concrete element type is
 * defined by the adapter package (backend handles must never leak upward).
 */
export interface BackendLowerResult {
  readonly success: boolean;
  readonly diagnostics: ReadonlyArray<BackendDiagnostic>;
  readonly resources: ReadonlyArray<unknown>;
}

/**
 * A deterministic, JSON-serializable resource plan.
 */
export interface BackendResourcePlan {
  readonly resources: ReadonlyArray<{
    readonly name: string;
    readonly resourceType: string;
    readonly dependsOn: ReadonlyArray<string>;
  }>;
  readonly outputs: Readonly<Record<string, unknown>>;
}

/**
 * Result of an apply/destroy operation.
 */
export interface BackendOperationResult {
  readonly success: boolean;
  readonly stackName: string;
  readonly outputs?: Readonly<Record<string, unknown>>;
  readonly error?: string;
}

/**
 * The interface every backend adapter implements (MCA-1).
 *
 * The kernel, binders, and policy engine never call adapters directly; the
 * orchestration layer (CLI or an embedding platform) selects an adapter by
 * name and drives lower → plan → deploy/destroy. Inputs are backend-neutral:
 * compiled intents plus an opaque graph snapshot. Outputs are structured
 * JSON objects — provider-native handles never cross this boundary.
 *
 * `TSnapshot`/`TPlan` are generic because contracts has zero dependencies;
 * concrete adapters bind them to the IR snapshot and their plan type.
 */
export interface BackendAdapter<TSnapshot = unknown, TPlan = unknown> {
  /** Unique adapter name used for selection (e.g. 'aws') */
  readonly name: string;

  /** Lower compiled intents + graph nodes to provider resources */
  lower(input: {
    readonly intents: ReadonlyArray<Intent>;
    readonly snapshot: TSnapshot;
    readonly adapterConfig: BackendAdapterConfig;
  }): BackendLowerResult;

  /** Generate a deterministic resource plan from a lower result */
  generatePlan(
    lowered: BackendLowerResult,
    config: BackendAdapterConfig,
  ): TPlan;

  /** Preview the plan against real provider state (dry run) */
  preview(
    plan: TPlan,
    config: BackendAdapterConfig,
  ): Promise<BackendOperationResult>;

  /** Apply the plan */
  deploy(
    plan: TPlan,
    config: BackendAdapterConfig,
  ): Promise<BackendOperationResult>;

  /** Tear down the stack previously created for this config */
  destroy(config: BackendAdapterConfig): Promise<BackendOperationResult>;
}
