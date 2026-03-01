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
    'sqs-dlq-missing': 'info',
    'lambda-timeout-excessive': 'warning',
    'telemetry-tracing-disabled': 'info',
    'cloudfront-ssl-protocol-weak': 'warning',
    'waf-not-attached': 'info',
    'stepfunctions-logging-disabled': 'info',
    'eventbridge-retry-missing': 'info',
    'ecs-task-public-ip': 'info',
    'alb-access-logs-disabled': 'info',
    'ecr-image-scan-disabled': 'info',
    's3-public-access-not-blocked': 'warning',
  },
  'FedRAMP-Moderate': {
    'iam-no-wildcard-resource': 'error',
    'iam-admin-access-review': 'warning',
    'iam-missing-conditions': 'warning',
    'network-broad-protocol': 'warning',
    'sqs-dlq-missing': 'warning',
    'lambda-timeout-excessive': 'warning',
    'telemetry-tracing-disabled': 'warning',
    'cloudfront-ssl-protocol-weak': 'error',
    'waf-not-attached': 'warning',
    'stepfunctions-logging-disabled': 'warning',
    'eventbridge-retry-missing': 'info',
    'ecs-task-public-ip': 'warning',
    'alb-access-logs-disabled': 'warning',
    'ecr-image-scan-disabled': 'warning',
    's3-public-access-not-blocked': 'error',
  },
  'FedRAMP-High': {
    'iam-no-wildcard-resource': 'error',
    'iam-admin-access-review': 'error',
    'iam-missing-conditions': 'error',
    'network-broad-protocol': 'error',
    'sqs-dlq-missing': 'error',
    'lambda-timeout-excessive': 'error',
    'telemetry-tracing-disabled': 'error',
    'cloudfront-ssl-protocol-weak': 'error',
    'waf-not-attached': 'error',
    'stepfunctions-logging-disabled': 'error',
    'eventbridge-retry-missing': 'warning',
    'ecs-task-public-ip': 'error',
    'alb-access-logs-disabled': 'error',
    'ecr-image-scan-disabled': 'error',
    's3-public-access-not-blocked': 'error',
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
