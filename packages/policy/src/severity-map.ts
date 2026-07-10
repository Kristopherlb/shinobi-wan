import type { Severity } from '@shinobi/contracts';

/**
 * Supported policy pack names.
 */
export const SUPPORTED_PACKS = [
  'Baseline',
  'FedRAMP-Moderate',
  'FedRAMP-High',
] as const;
export type SupportedPack = (typeof SUPPORTED_PACKS)[number];

/**
 * Maps (policyPack, ruleId) → Severity.
 *
 * Severity escalates from Baseline → Moderate → High.
 * No code branches on pack name — KL-008 enforced via data.
 */
export const SEVERITY_MAP: Readonly<
  Record<SupportedPack, Readonly<Record<string, Severity>>>
> = {
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
    'eks-endpoint-public-access': 'warning',
    'eks-logging-disabled': 'info',
    's3-public-access-not-blocked': 'warning',
    'sfn-max-recursion': 'warning',
    'secrets-rotation-disabled': 'info',
    'kms-key-rotation-disabled': 'warning',
    'elasticache-encryption-disabled': 'info',
    'elasticache-auth-disabled': 'info',
    'budget-threshold-missing': 'info',
    'bedrock-guardrails-disabled': 'info',
    'sagemaker-vpc-disabled': 'info',
    'opensearch-encryption-disabled': 'info',
    'opensearch-public-access': 'warning',
    'firehose-encryption-disabled': 'info',
    'rds-encryption-disabled': 'info',
    'rds-public-access': 'warning',
    'cloudtrail-log-validation-disabled': 'warning',
    'guardduty-not-enabled': 'info',
    'glue-job-security-config-missing': 'info',
    'athena-workgroup-encryption-disabled': 'info',
    'athena-workgroup-bytes-limit-missing': 'info',
    'sagemaker-pipeline-parallelism-missing': 'info',
    'msk-encryption-in-transit-disabled': 'warning',
    'msk-authentication-disabled': 'info',
    'transit-gateway-auto-accept-enabled': 'info',
    'network-firewall-logging-disabled': 'warning',
    'route53-health-check-missing': 'info',
    'eks-gpu-spot-capacity': 'info',
    'eks-addon-version-unset': 'info',
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
    'eks-endpoint-public-access': 'error',
    'eks-logging-disabled': 'warning',
    's3-public-access-not-blocked': 'error',
    'sfn-max-recursion': 'warning',
    'secrets-rotation-disabled': 'warning',
    'kms-key-rotation-disabled': 'error',
    'elasticache-encryption-disabled': 'warning',
    'elasticache-auth-disabled': 'warning',
    'budget-threshold-missing': 'warning',
    'bedrock-guardrails-disabled': 'warning',
    'sagemaker-vpc-disabled': 'warning',
    'opensearch-encryption-disabled': 'warning',
    'opensearch-public-access': 'error',
    'firehose-encryption-disabled': 'warning',
    'rds-encryption-disabled': 'error',
    'rds-public-access': 'error',
    'cloudtrail-log-validation-disabled': 'error',
    'guardduty-not-enabled': 'warning',
    'glue-job-security-config-missing': 'warning',
    'athena-workgroup-encryption-disabled': 'warning',
    'athena-workgroup-bytes-limit-missing': 'info',
    'sagemaker-pipeline-parallelism-missing': 'info',
    'msk-encryption-in-transit-disabled': 'error',
    'msk-authentication-disabled': 'warning',
    'transit-gateway-auto-accept-enabled': 'warning',
    'network-firewall-logging-disabled': 'error',
    'route53-health-check-missing': 'info',
    'eks-gpu-spot-capacity': 'warning',
    'eks-addon-version-unset': 'warning',
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
    'eks-endpoint-public-access': 'error',
    'eks-logging-disabled': 'error',
    's3-public-access-not-blocked': 'error',
    'sfn-max-recursion': 'error',
    'secrets-rotation-disabled': 'error',
    'kms-key-rotation-disabled': 'error',
    'elasticache-encryption-disabled': 'error',
    'elasticache-auth-disabled': 'error',
    'budget-threshold-missing': 'error',
    'bedrock-guardrails-disabled': 'error',
    'sagemaker-vpc-disabled': 'error',
    'opensearch-encryption-disabled': 'error',
    'opensearch-public-access': 'error',
    'firehose-encryption-disabled': 'error',
    'rds-encryption-disabled': 'error',
    'rds-public-access': 'error',
    'cloudtrail-log-validation-disabled': 'error',
    'guardduty-not-enabled': 'error',
    'glue-job-security-config-missing': 'error',
    'athena-workgroup-encryption-disabled': 'error',
    'athena-workgroup-bytes-limit-missing': 'warning',
    'sagemaker-pipeline-parallelism-missing': 'warning',
    'msk-encryption-in-transit-disabled': 'error',
    'msk-authentication-disabled': 'error',
    'transit-gateway-auto-accept-enabled': 'error',
    'network-firewall-logging-disabled': 'error',
    'route53-health-check-missing': 'warning',
    'eks-gpu-spot-capacity': 'warning',
    'eks-addon-version-unset': 'error',
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
      `Unknown policy pack "${policyPack}". Supported: ${SUPPORTED_PACKS.join(', ')}`,
    );
  }
  const severity = packMap[ruleId];
  if (!severity) {
    throw new Error(
      `Rule "${ruleId}" not found in severity map for pack "${policyPack}"`,
    );
  }
  return severity;
}
