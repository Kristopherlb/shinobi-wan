/**
 * Kernel facade API contract version for Harmony integration.
 * Bump when envelope or facade input/output shape changes in a breaking way.
 */
export const CONTRACT_VERSION = '1.0.0' as const;
export type ContractVersion = typeof CONTRACT_VERSION;
