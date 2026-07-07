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
      summary:
        "Consider 'read' or 'write' access level. Admin grants full control",
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
    description: "Network intents with protocol 'any' are overly permissive.",
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
      summary:
        'Reduce Lambda timeout to 900 seconds or less, or use Step Functions for long-running workflows',
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
      summary:
        'Add a WAF v2 Web ACL and associate it with the CloudFront distribution',
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
      summary:
        'Add retryPolicy with maximumRetryAttempts to the schedule configuration',
      autoFixable: true,
    },
  },
  {
    ruleId: 'ecs-task-public-ip',
    ruleName: 'ECS Task Public IP',
    description:
      'Fargate tasks should not assign public IP addresses. Use private subnets with NAT gateways for internet access.',
    remediation: {
      summary:
        'Set assignPublicIp to false (DISABLED) in the ECS service configuration',
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
    ruleId: 'eks-endpoint-public-access',
    ruleName: 'EKS Endpoint Public Access',
    description:
      'EKS clusters should not expose the Kubernetes API endpoint publicly. Use VPN or bastion hosts for access.',
    remediation: {
      summary:
        'Disable public endpoint access and use VPN/bastion for cluster management',
      autoFixable: true,
    },
  },
  {
    ruleId: 'eks-logging-disabled',
    ruleName: 'EKS Logging Disabled',
    description:
      'EKS clusters should enable control plane logging (API, audit, authenticator) for security monitoring and troubleshooting.',
    remediation: {
      summary:
        'Enable API, audit, and authenticator log types on the EKS cluster',
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
  {
    ruleId: 'sfn-max-recursion',
    ruleName: 'Step Functions Max Recursion Exceeded',
    description:
      'Step Functions state machines with excessive recursion depth risk infinite loops and resource exhaustion. Keep maxRecursionDepth within safe limits.',
    remediation: {
      summary:
        'Reduce maxRecursionDepth to 50 or less, or refactor into separate state machines with dynamic parallelism',
      autoFixable: false,
    },
  },
  {
    ruleId: 'secrets-rotation-disabled',
    ruleName: 'Secrets Rotation Disabled',
    description:
      'SecretsManager secrets should have automatic rotation enabled to reduce the risk of compromised credentials.',
    remediation: {
      summary: 'Set rotationEnabled: true in the SecretsManager configuration',
      autoFixable: true,
    },
  },
  {
    ruleId: 'kms-key-rotation-disabled',
    ruleName: 'KMS Key Rotation Disabled',
    description:
      'Symmetric KMS keys should have automatic key rotation enabled. Rotation limits the amount of data encrypted under a single key version.',
    remediation: {
      summary: 'Set enableKeyRotation: true for symmetric KMS keys',
      autoFixable: true,
    },
  },
  {
    ruleId: 'elasticache-encryption-disabled',
    ruleName: 'ElastiCache Encryption Disabled',
    description:
      'ElastiCache Redis replication groups should have both at-rest and in-transit encryption enabled to protect cached data.',
    remediation: {
      summary:
        'Set atRestEncryptionEnabled: true and transitEncryptionEnabled: true',
      autoFixable: true,
    },
  },
  {
    ruleId: 'elasticache-auth-disabled',
    ruleName: 'ElastiCache Auth Disabled',
    description:
      'ElastiCache Redis replication groups should require AUTH tokens when transit encryption is enabled to prevent unauthorized access.',
    remediation: {
      summary: 'Set transitEncryptionEnabled: true and provide an authToken',
      autoFixable: false,
    },
  },
  {
    ruleId: 'budget-threshold-missing',
    ruleName: 'Budget Threshold Missing',
    description:
      'AWS Budgets should have a notification threshold configured with an SNS topic to alert on cost overruns.',
    remediation: {
      summary:
        'Set thresholdPercentage and notificationTopicArn in the budget configuration',
      autoFixable: false,
    },
  },
  {
    ruleId: 'bedrock-guardrails-disabled',
    ruleName: 'Bedrock Guardrails Disabled',
    description:
      'Amazon Bedrock model invocations should have guardrails enabled to control content filtering and prevent harmful outputs.',
    remediation: {
      summary: 'Set guardrailEnabled: true in the Bedrock configuration',
      autoFixable: true,
    },
  },
  {
    ruleId: 'sagemaker-vpc-disabled',
    ruleName: 'SageMaker VPC Disabled',
    description:
      'SageMaker models should be deployed within a VPC for network isolation. Running without VPC exposes the model to public network risks.',
    remediation: {
      summary: 'Configure vpcConfig with subnetIds and securityGroupIds',
      autoFixable: false,
    },
  },
  {
    ruleId: 'opensearch-encryption-disabled',
    ruleName: 'OpenSearch Encryption Disabled',
    description:
      'OpenSearch domains should have both at-rest and node-to-node encryption enabled to protect data in transit and at rest.',
    remediation: {
      summary: 'Set encryptionAtRest: true and nodeToNodeEncryption: true',
      autoFixable: true,
    },
  },
  {
    ruleId: 'opensearch-public-access',
    ruleName: 'OpenSearch Public Access',
    description:
      'OpenSearch domains and serverless collections should not be publicly accessible. Use VPC endpoints for access.',
    remediation: {
      summary: 'Set publicAccess: false and configure VPC endpoints',
      autoFixable: false,
    },
  },
  {
    ruleId: 'cloudtrail-log-validation-disabled',
    ruleName: 'CloudTrail Log Validation Disabled',
    description:
      'CloudTrail trails should have log file validation enabled to detect unauthorized modifications to log files.',
    remediation: {
      summary:
        'Set enableLogFileValidation: true in the CloudTrail configuration',
      autoFixable: true,
    },
  },
  {
    ruleId: 'guardduty-not-enabled',
    ruleName: 'GuardDuty Not Enabled',
    description:
      'GuardDuty should be enabled for threat detection and continuous security monitoring.',
    remediation: {
      summary: 'Set enabled: true in the GuardDuty detector configuration',
      autoFixable: true,
    },
  },
  {
    ruleId: 'rds-encryption-disabled',
    ruleName: 'RDS Encryption Disabled',
    description:
      'Aurora/RDS clusters should have storage encryption enabled to protect data at rest.',
    remediation: {
      summary: 'Set storageEncrypted: true in the RDS cluster configuration',
      autoFixable: true,
    },
  },
  {
    ruleId: 'rds-public-access',
    ruleName: 'RDS Public Access',
    description:
      'RDS clusters should not be publicly accessible. Use VPC private subnets and RDS Proxy for application access.',
    remediation: {
      summary: 'Set publicAccess: false and use RDS Proxy for connections',
      autoFixable: false,
    },
  },
  {
    ruleId: 'firehose-encryption-disabled',
    ruleName: 'Firehose Encryption Disabled',
    description:
      'Kinesis Firehose delivery streams should have server-side encryption enabled to protect data in transit.',
    remediation: {
      summary: 'Set encryptionEnabled: true in the Firehose configuration',
      autoFixable: true,
    },
  },
  {
    ruleId: 'glue-job-security-config-missing',
    ruleName: 'Glue Job Security Config Missing',
    description:
      'AWS Glue jobs should have a security configuration to encrypt data at rest and in transit.',
    remediation: {
      summary: 'Set securityConfiguration in the Glue job configuration',
      autoFixable: false,
    },
  },
  {
    ruleId: 'athena-workgroup-encryption-disabled',
    ruleName: 'Athena Workgroup Encryption Disabled',
    description:
      'Athena workgroups should have result encryption enabled to protect query results at rest.',
    remediation: {
      summary:
        'Set encryptionOption to SSE_S3 or SSE_KMS in the Athena workgroup configuration',
      autoFixable: true,
    },
  },
  {
    ruleId: 'athena-workgroup-bytes-limit-missing',
    ruleName: 'Athena Workgroup Bytes Limit Missing',
    description:
      'Athena workgroups should have a bytes scanned cutoff to prevent runaway queries from incurring excessive costs.',
    remediation: {
      summary:
        'Set bytesScannedCutoffPerQuery in the Athena workgroup configuration',
      autoFixable: false,
    },
  },
  {
    ruleId: 'sagemaker-pipeline-parallelism-missing',
    ruleName: 'SageMaker Pipeline Parallelism Missing',
    description:
      'SageMaker pipelines should have parallelism configuration to control resource usage during execution.',
    remediation: {
      summary: 'Set parallelismConfiguration with maxParallelExecutionSteps',
      autoFixable: false,
    },
  },
  {
    ruleId: 'msk-encryption-in-transit-disabled',
    ruleName: 'MSK Encryption In Transit Disabled',
    description:
      'MSK clusters should use TLS encryption for client-broker communication to protect data in transit.',
    remediation: {
      summary:
        "Set encryptionInTransit to 'TLS' in the MSK cluster configuration",
      autoFixable: true,
    },
  },
  {
    ruleId: 'msk-authentication-disabled',
    ruleName: 'MSK Authentication Disabled',
    description:
      'MSK clusters should have client authentication enabled (SASL-IAM, SASL-SCRAM, or TLS) to prevent unauthorized access.',
    remediation: {
      summary:
        'Configure clientAuthentication with SASL-IAM, SASL-SCRAM, or TLS',
      autoFixable: false,
    },
  },
  {
    ruleId: 'transit-gateway-auto-accept-enabled',
    ruleName: 'Transit Gateway Auto Accept Enabled',
    description:
      'Transit gateways should not auto-accept shared attachments to prevent unauthorized VPC connections.',
    remediation: {
      summary: "Set autoAcceptSharedAttachments to 'disable'",
      autoFixable: true,
    },
  },
  {
    ruleId: 'network-firewall-logging-disabled',
    ruleName: 'Network Firewall Logging Disabled',
    description:
      'AWS Network Firewall should have logging enabled for security monitoring and forensic analysis.',
    remediation: {
      summary: 'Set loggingEnabled: true in the Network Firewall configuration',
      autoFixable: true,
    },
  },
  {
    ruleId: 'route53-health-check-missing',
    ruleName: 'Route53 Health Check Missing',
    description:
      'Public Route53 hosted zones should have health checks configured for DNS failover and monitoring.',
    remediation: {
      summary: 'Add a healthCheck configuration to the Route53 zone',
      autoFixable: false,
    },
  },
  {
    ruleId: 'eks-gpu-spot-capacity',
    ruleName: 'EKS GPU Spot Capacity',
    description:
      'GPU node groups using SPOT capacity may be interrupted, causing training jobs or inference workloads to fail. Use ON_DEMAND for production GPU workloads.',
    remediation: {
      summary: "Set capacityType to 'ON_DEMAND' for production GPU node groups",
      autoFixable: true,
    },
  },
  {
    ruleId: 'eks-addon-version-unset',
    ruleName: 'EKS Addon Version Unset',
    description:
      'EKS addons should pin a specific version to prevent unexpected upgrades that may cause compatibility issues.',
    remediation: {
      summary: 'Set addonVersion to a specific version string',
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
