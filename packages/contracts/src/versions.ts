/**
 * Central version constants for all contract schemas.
 * All contracts use the same version for simplicity.
 */
export const CONTRACT_SCHEMA_VERSION = '1.0.0' as const;

export type ContractSchemaVersion = typeof CONTRACT_SCHEMA_VERSION;
