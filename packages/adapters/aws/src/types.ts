import type { Intent, IamIntent, NetworkIntent, ConfigIntent } from '@shinobi/contracts';
import type { Node, GraphSnapshot } from '@shinobi/ir';

/**
 * A single AWS resource to be created by Pulumi.
 */
export interface LoweredResource {
  /** Stable name derived from kernel IDs */
  readonly name: string;
  /** AWS resource type (e.g., 'aws:iam:Role', 'aws:lambda:Function') */
  readonly resourceType: string;
  /** Resource properties for the Pulumi constructor */
  readonly properties: Readonly<Record<string, unknown>>;
  /** Source intent or node that generated this resource */
  readonly sourceId: string;
  /** Dependencies: names of other LoweredResources this depends on */
  readonly dependsOn: ReadonlyArray<string>;
}

/**
 * Context for the lowering process.
 */
export interface LoweringContext {
  /** The compiled intents to lower */
  readonly intents: ReadonlyArray<Intent>;
  /** Graph snapshot for node lookups */
  readonly snapshot: GraphSnapshot;
  /** Adapter configuration */
  readonly adapterConfig: AdapterConfig;
}

/**
 * Adapter configuration.
 */
export interface AdapterConfig {
  /** AWS region for resource creation */
  readonly region: string;
  /** Service name for resource naming prefix */
  readonly serviceName: string;
  /** Optional: path to Lambda code artifact */
  readonly codePath?: string;
  /** Optional: S3 bucket/key for Lambda code */
  readonly codeS3?: { readonly bucket: string; readonly key: string };
  /** Optional: correlation trace identifier passed from external tool surfaces */
  readonly traceId?: string;
  /** Optional: tool version emitted by wrapper/tooling surfaces */
  readonly toolVersion?: string;
  /** Optional: contract version emitted by wrapper/tooling surfaces */
  readonly contractVersion?: string;
}

/**
 * Diagnostic from the lowering process.
 */
export interface LoweringDiagnostic {
  readonly severity: 'error' | 'warning' | 'info';
  readonly message: string;
  readonly sourceId: string;
  /** Stable machine-friendly error code when available */
  readonly code?: string;
  /** Retry hint for external orchestration layers */
  readonly retriable?: boolean;
  /** Stable reason enum when retriable is true */
  readonly retriableReason?:
    | 'rate_limit'
    | 'upstream_timeout'
    | 'upstream_5xx'
    | 'transport_unavailable'
    | 'worker_unavailable'
    | 'dependency_unavailable';
}

/**
 * Result of the lowering process.
 */
export interface AdapterResult {
  /** All resources to be created, in dependency order */
  readonly resources: ReadonlyArray<LoweredResource>;
  /** Mapping from kernel ID → resource names */
  readonly resourceMap: Readonly<Record<string, ReadonlyArray<string>>>;
  /** Diagnostics from the lowering process */
  readonly diagnostics: ReadonlyArray<LoweringDiagnostic>;
  /** Whether lowering was successful (no error diagnostics) */
  readonly success: boolean;
}

/**
 * Interface for intent lowerers.
 */
export interface IntentLowerer<T extends Intent = Intent> {
  readonly intentType: T['type'];
  lower(intent: T, context: LoweringContext): ReadonlyArray<LoweredResource>;
}

/**
 * Interface for node (resource) lowerers.
 */
export interface NodeLowerer {
  readonly platform: string;
  lower(node: Node, context: LoweringContext, resolvedDeps: ResolvedDeps): ReadonlyArray<LoweredResource>;
}

/**
 * Dependencies resolved from intents for a specific node.
 */
export interface ResolvedDeps {
  /** IAM role name for this node (if any) */
  readonly roleName?: string;
  /** Environment variables from config intents */
  readonly envVars: Readonly<Record<string, unknown>>;
  /** Security group names for this node (if any) */
  readonly securityGroups: ReadonlyArray<string>;
}
