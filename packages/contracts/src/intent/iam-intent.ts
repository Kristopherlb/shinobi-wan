import type { Intent } from './intent-base';

/**
 * Principal requesting access in an IAM intent.
 * Backend-neutral - references nodes, not provider ARNs.
 */
export interface IamPrincipal {
  /** Reference to the source node */
  readonly nodeRef: string;

  /** Logical role (e.g., "service", "function", "container") */
  readonly role: string;
}

/**
 * Resource being accessed in an IAM intent.
 * Backend-neutral - references nodes, not provider ARNs.
 */
export interface IamResource {
  /** Reference to the target node */
  readonly nodeRef: string;

  /** Resource type (e.g., "queue", "bucket", "table") */
  readonly resourceType: string;

  /** Scope: specific resource or pattern (no wildcards in strict mode) */
  readonly scope: 'specific' | 'pattern';

  /** Pattern for scope=pattern (e.g., "uploads/*") */
  readonly pattern?: string;
}

/**
 * Action being granted in an IAM intent.
 */
export interface IamAction {
  /** High-level action profile */
  readonly level: 'read' | 'write' | 'admin';

  /** Specific action name (backend-neutral) */
  readonly action: string;
}

/**
 * Condition for scoped access in an IAM intent.
 */
export interface IamCondition {
  /** Condition key */
  readonly key: string;

  /** Condition operator */
  readonly operator: 'equals' | 'notEquals' | 'contains' | 'startsWith';

  /** Condition value */
  readonly value: string;
}

/**
 * Backend-neutral IAM permission intent.
 *
 * Binders emit this; adapters lower to provider-specific policies.
 * No AWS/GCP/Azure specific fields allowed.
 */
export interface IamIntent extends Intent {
  readonly type: 'iam';

  /** Principal requesting access */
  readonly principal: IamPrincipal;

  /** Resource being accessed */
  readonly resource: IamResource;

  /** Actions being granted */
  readonly actions: ReadonlyArray<IamAction>;

  /** Conditions for access (optional) */
  readonly conditions?: ReadonlyArray<IamCondition>;
}
