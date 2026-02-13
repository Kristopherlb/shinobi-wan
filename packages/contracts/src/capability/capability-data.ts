import type { CapabilityId } from './capability-id';

/**
 * Field types for capability data shapes.
 * Backend-neutral - no provider-specific constructs.
 */
export type CapabilityFieldType =
  | { readonly type: 'string' }
  | { readonly type: 'number' }
  | { readonly type: 'boolean' }
  | { readonly type: 'reference'; readonly targetCapability: CapabilityId };

/**
 * Data shape exposed by a capability.
 * Defines the fields consumers can access.
 */
export interface CapabilityDataShape {
  /** Fields exposed to consumers (no provider-specific fields) */
  readonly fields: Readonly<Record<string, CapabilityFieldType>>;
}
