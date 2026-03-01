import type { RemediationHint } from '@shinobi/contracts';

/**
 * A policy rule definition — pure data, no code.
 */
export interface PolicyRule {
  readonly ruleId: string;
  readonly ruleName: string;
  readonly description: string;
  readonly remediation: RemediationHint;
}

/**
 * Canonical rule catalog.
 * Rules are data; severity is determined by the pack via severity-map.
 */
export const RULE_CATALOG: ReadonlyArray<PolicyRule> = [
  {
    ruleId: 'iam-no-wildcard-resource',
    ruleName: 'No Wildcard Resources',
    description:
      'IAM intents must not use pattern-scoped resources. Wildcard/pattern scopes violate least privilege (KL-005).',
    remediation: {
      summary: "Use scope 'specific' with explicit resource references",
      autoFixable: false,
    },
  },
  {
    ruleId: 'iam-admin-access-review',
    ruleName: 'Admin Access Review',
    description:
      'IAM intents with admin-level actions require justification. Admin grants full control (KL-005).',
    remediation: {
      summary: "Consider 'read' or 'write' access level. Admin grants full control",
      autoFixable: false,
    },
  },
  {
    ruleId: 'iam-missing-conditions',
    ruleName: 'Missing IAM Conditions',
    description:
      'Cross-service IAM grants should include conditions to scope access.',
    remediation: {
      summary: 'Add conditions to scope cross-service access',
      autoFixable: false,
    },
  },
  {
    ruleId: 'network-broad-protocol',
    ruleName: 'Broad Network Protocol',
    description:
      "Network intents with protocol 'any' are overly permissive.",
    remediation: {
      summary: "Specify protocol as 'tcp' or 'udp' instead of 'any'",
      autoFixable: false,
    },
  },
  {
    ruleId: 'sqs-dlq-missing',
    ruleName: 'SQS DLQ Missing',
    description:
      'SQS queues should have dead letter queues configured to capture failed messages and prevent data loss.',
    remediation: {
      summary: 'Add deadLetterQueue: true to the SQS queue configuration',
      autoFixable: true,
    },
  },
  {
    ruleId: 'lambda-timeout-excessive',
    ruleName: 'Lambda Timeout Excessive',
    description:
      'Lambda functions with timeout exceeding 900 seconds may indicate architectural issues. Consider breaking into smaller functions or using Step Functions.',
    remediation: {
      summary: 'Reduce Lambda timeout to 900 seconds or less, or use Step Functions for long-running workflows',
      autoFixable: false,
    },
  },
  {
    ruleId: 'telemetry-tracing-disabled',
    ruleName: 'Telemetry Tracing Disabled',
    description:
      'X-Ray tracing should be enabled on compute resources for observability and debugging.',
    remediation: {
      summary: 'Add tracing: true to the Lambda function configuration',
      autoFixable: true,
    },
  },
  {
    ruleId: 'cloudfront-ssl-protocol-weak',
    ruleName: 'CloudFront Weak SSL Protocol',
    description:
      'CloudFront distributions should use TLSv1.2 or higher. Older protocols have known vulnerabilities.',
    remediation: {
      summary: 'Set minimumProtocolVersion to TLSv1.2_2021 or higher',
      autoFixable: true,
    },
  },
  {
    ruleId: 'waf-not-attached',
    ruleName: 'WAF Not Attached',
    description:
      'Public-facing CloudFront distributions should have a WAF Web ACL attached for protection against common web exploits.',
    remediation: {
      summary: 'Add a WAF v2 Web ACL and associate it with the CloudFront distribution',
      autoFixable: false,
    },
  },
  {
    ruleId: 'stepfunctions-logging-disabled',
    ruleName: 'Step Functions Logging Disabled',
    description:
      'Step Functions state machines should have CloudWatch logging enabled for debugging and auditing.',
    remediation: {
      summary: 'Add logging: true to the Step Functions configuration',
      autoFixable: true,
    },
  },
  {
    ruleId: 'eventbridge-retry-missing',
    ruleName: 'EventBridge Retry Missing',
    description:
      'EventBridge Scheduler schedules should configure a retry policy to handle transient failures.',
    remediation: {
      summary: 'Add retryPolicy with maximumRetryAttempts to the schedule configuration',
      autoFixable: true,
    },
  },
  {
    ruleId: 'ecs-task-public-ip',
    ruleName: 'ECS Task Public IP',
    description:
      'Fargate tasks should not assign public IP addresses. Use private subnets with NAT gateways for internet access.',
    remediation: {
      summary: 'Set assignPublicIp to false (DISABLED) in the ECS service configuration',
      autoFixable: true,
    },
  },
  {
    ruleId: 'alb-access-logs-disabled',
    ruleName: 'ALB Access Logs Disabled',
    description:
      'Application Load Balancers should enable access logging for auditing and troubleshooting.',
    remediation: {
      summary: 'Enable access logging on the ALB with an S3 bucket destination',
      autoFixable: false,
    },
  },
  {
    ruleId: 'ecr-image-scan-disabled',
    ruleName: 'ECR Image Scan Disabled',
    description:
      'ECR repositories should enable image scanning on push to detect vulnerabilities in container images.',
    remediation: {
      summary: 'Set scanOnPush: true in the ECR repository configuration',
      autoFixable: true,
    },
  },
  {
    ruleId: 's3-public-access-not-blocked',
    ruleName: 'S3 Public Access Not Blocked',
    description:
      'S3 buckets used as CloudFront origins should use Origin Access Control (OAC), not public access. Public buckets expose data.',
    remediation: {
      summary: 'Use CloudFront OAC instead of public S3 bucket access',
      autoFixable: false,
    },
  },
];

/**
 * Look up a rule by its ID.
 * Returns undefined if not found.
 */
export function getRuleById(ruleId: string): PolicyRule | undefined {
  return RULE_CATALOG.find((r) => r.ruleId === ruleId);
}
