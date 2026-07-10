import type { ContractSchemaVersion } from '../versions';

/**
 * Intent types supported by the system.
 */
export const INTENT_TYPES = ['iam', 'network', 'config', 'telemetry'] as const;
export type IntentType = (typeof INTENT_TYPES)[number];

/**
 * Base interface for all intents.
 *
 * Intents are backend-neutral representations of desired effects.
 * Binders emit intents; adapters lower them to provider-specific resources.
 */
export interface Intent {
  /** Intent type discriminator */
  readonly type: IntentType;

  /** Schema version for forward compatibility */
  readonly schemaVersion: ContractSchemaVersion;

  /** Edge that generated this intent */
  readonly sourceEdgeId: string;
}
