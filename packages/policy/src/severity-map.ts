import type { Severity } from '@shinobi/contracts';

/**
 * Supported policy pack names.
 */
export const SUPPORTED_PACKS = ['Baseline', 'FedRAMP-Moderate', 'FedRAMP-High'] as const;
export type SupportedPack = (typeof SUPPORTED_PACKS)[number];

/**
 * Maps (policyPack, ruleId) → Severity.
 *
 * Severity escalates from Baseline → Moderate → High.
 * No code branches on pack name — KL-008 enforced via data.
 */
export const SEVERITY_MAP: Readonly<Record<SupportedPack, Readonly<Record<string, Severity>>>> = {
  Baseline: {
    'iam-no-wildcard-resource': 'warning',
    'iam-admin-access-review': 'info',
    'iam-missing-conditions': 'info',
    'network-broad-protocol': 'info',
  },
  'FedRAMP-Moderate': {
    'iam-no-wildcard-resource': 'error',
    'iam-admin-access-review': 'warning',
    'iam-missing-conditions': 'warning',
    'network-broad-protocol': 'warning',
  },
  'FedRAMP-High': {
    'iam-no-wildcard-resource': 'error',
    'iam-admin-access-review': 'error',
    'iam-missing-conditions': 'error',
    'network-broad-protocol': 'error',
  },
};

/**
 * Looks up severity for a given policy pack and rule ID.
 * @throws Error if pack is unknown or rule is not in map
 */
export function getSeverity(policyPack: string, ruleId: string): Severity {
  const packMap = SEVERITY_MAP[policyPack as SupportedPack];
  if (!packMap) {
    throw new Error(
      `Unknown policy pack "${policyPack}". Supported: ${SUPPORTED_PACKS.join(', ')}`
    );
  }
  const severity = packMap[ruleId];
  if (!severity) {
    throw new Error(
      `Rule "${ruleId}" not found in severity map for pack "${policyPack}"`
    );
  }
  return severity;
}
