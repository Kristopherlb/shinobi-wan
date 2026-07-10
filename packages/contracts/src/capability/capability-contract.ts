import type { ContractSchemaVersion } from '../versions';
import type { CapabilityId } from './capability-id';
import type { CapabilityDataShape } from './capability-data';

/**
 * Standard action levels a capability can support.
 */
export const CAPABILITY_ACTIONS = ['read', 'write', 'admin', 'invoke'] as const;
export type CapabilityAction = (typeof CAPABILITY_ACTIONS)[number];

/**
 * Contract defining what a capability provides.
 *
 * Components declare "provides" and "requires" using capability contracts.
 * Binders use these contracts to understand compatibility.
 */
export interface CapabilityContract {
  /** Versioned capability identifier */
  readonly id: CapabilityId;

  /** Schema version for forward compatibility */
  readonly schemaVersion: ContractSchemaVersion;

  /** Human-readable description */
  readonly description: string;

  /** Data shape this capability exposes (for consumers) */
  readonly dataShape: CapabilityDataShape;

  /** Actions this capability supports */
  readonly actions: ReadonlyArray<CapabilityAction>;
}
