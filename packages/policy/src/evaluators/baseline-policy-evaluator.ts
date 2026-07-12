import type { Violation, IamIntent, NetworkIntent } from '@shinobi/contracts';
import type {
  IPolicyEvaluator,
  PolicyEvaluationContext,
} from '@shinobi/kernel';
import { SUPPORTED_PACKS } from '../severity-map';
import { getSeverity } from '../severity-map';
import { getRuleById, type PolicyRule } from '../rules';
import { createViolation } from '../violation-factory';
import { applyPolicyExceptions, parsePolicyExceptions } from '../exceptions';

// Pre-resolve rules at module load — avoids repeated lookups and non-null assertions.
const RULE_IAM_WILDCARD = getRuleById('iam-no-wildcard-resource');
const RULE_IAM_ADMIN = getRuleById('iam-admin-access-review');
const RULE_IAM_CONDITIONS = getRuleById('iam-missing-conditions');
const RULE_NETWORK_PROTOCOL = getRuleById('network-broad-protocol');

/**
 * Node-level rule check definition — rules as data (KL-008).
 * Each entry maps a platform + property condition to a violation.
 */
interface NodeRuleCheck {
  readonly platform: string;
  readonly rule: PolicyRule;
  readonly failsWhen: (properties: Record<string, unknown>) => boolean;
  readonly formatMessage: (
    nodeId: string,
    properties: Record<string, unknown>,
  ) => string;
}

/** Data-driven node-level rule checks. Adding a new rule = adding one entry here. */
const NODE_RULE_CHECKS: ReadonlyArray<NodeRuleCheck> = [
  {
    platform: 'aws-sqs',
    rule: getRuleById('sqs-dlq-missing')!,
    failsWhen: (props) => props['deadLetterQueue'] !== true,
    formatMessage: (nodeId) =>
      `SQS queue "${nodeId}" does not have a dead letter queue configured. Failed messages may be lost.`,
  },
  {
    platform: 'aws-lambda',
    rule: getRuleById('lambda-timeout-excessive')!,
    failsWhen: (props) =>
      typeof props['timeout'] === 'number' &&
      (props['timeout'] as number) > 900,
    formatMessage: (nodeId, props) =>
      `Lambda function "${nodeId}" has timeout of ${props['timeout']}s which exceeds 900s maximum. Consider Step Functions for long-running workflows.`,
  },
  {
    platform: 'aws-lambda',
    rule: getRuleById('telemetry-tracing-disabled')!,
    failsWhen: (props) => props['tracing'] !== true,
    formatMessage: (nodeId) =>
      `Lambda function "${nodeId}" does not have X-Ray tracing enabled.`,
  },
  {
    platform: 'aws-cloudfront',
    rule: getRuleById('cloudfront-ssl-protocol-weak')!,
    failsWhen: (props) => {
      const weakProtocols = ['SSLv3', 'TLSv1', 'TLSv1_2016', 'TLSv1.1_2016'];
      return (
        typeof props['minimumProtocolVersion'] === 'string' &&
        weakProtocols.includes(props['minimumProtocolVersion'])
      );
    },
    formatMessage: (nodeId, props) =>
      `CloudFront distribution "${nodeId}" uses weak SSL protocol "${props['minimumProtocolVersion']}". Use TLSv1.2_2021 or higher.`,
  },
  {
    platform: 'aws-cloudfront',
    rule: getRuleById('waf-not-attached')!,
    failsWhen: (props) => props['wafAclArn'] === undefined,
    formatMessage: (nodeId) =>
      `CloudFront distribution "${nodeId}" does not have a WAF Web ACL attached.`,
  },
  {
    platform: 'aws-stepfunctions',
    rule: getRuleById('stepfunctions-logging-disabled')!,
    failsWhen: (props) =>
      props['logging'] === false || props['logging'] === undefined,
    formatMessage: (nodeId) =>
      `Step Functions state machine "${nodeId}" does not have CloudWatch logging enabled.`,
  },
  {
    platform: 'aws-eventbridge-scheduler',
    rule: getRuleById('eventbridge-retry-missing')!,
    failsWhen: (props) => props['retryPolicy'] === undefined,
    formatMessage: (nodeId) =>
      `EventBridge schedule "${nodeId}" does not have a retry policy configured.`,
  },
  {
    platform: 'aws-s3',
    rule: getRuleById('s3-public-access-not-blocked')!,
    failsWhen: (props) => props['publicAccess'] === true,
    formatMessage: (nodeId) =>
      `S3 bucket "${nodeId}" has public access enabled. Use CloudFront OAC instead.`,
  },
  {
    platform: 'aws-ecs-service',
    rule: getRuleById('ecs-task-public-ip')!,
    failsWhen: (props) => props['assignPublicIp'] === true,
    formatMessage: (nodeId) =>
      `ECS service "${nodeId}" assigns public IP to Fargate tasks. Use private subnets with NAT gateways.`,
  },
  {
    platform: 'aws-alb',
    rule: getRuleById('alb-access-logs-disabled')!,
    failsWhen: (props) => props['accessLogs'] !== true,
    formatMessage: (nodeId) =>
      `ALB "${nodeId}" does not have access logging enabled.`,
  },
  {
    platform: 'aws-ecr',
    rule: getRuleById('ecr-image-scan-disabled')!,
    failsWhen: (props) => props['scanOnPush'] === false,
    formatMessage: (nodeId) =>
      `ECR repository "${nodeId}" does not have image scanning on push enabled.`,
  },
  {
    platform: 'aws-eks-cluster',
    rule: getRuleById('eks-endpoint-public-access')!,
    failsWhen: (props) => props['endpointPublicAccess'] === true,
    formatMessage: (nodeId) =>
      `EKS cluster "${nodeId}" has public endpoint access enabled. Use VPN or bastion hosts.`,
  },
  {
    platform: 'aws-eks-cluster',
    rule: getRuleById('eks-logging-disabled')!,
    failsWhen: (props) => {
      const logTypes = props['enabledClusterLogTypes'];
      return !Array.isArray(logTypes) || logTypes.length === 0;
    },
    formatMessage: (nodeId) =>
      `EKS cluster "${nodeId}" does not have control plane logging enabled.`,
  },
  {
    platform: 'aws-stepfunctions',
    rule: getRuleById('sfn-max-recursion')!,
    failsWhen: (props) => {
      const depth = props['maxRecursionDepth'] as number | undefined;
      return typeof depth === 'number' && depth > 50;
    },
    formatMessage: (nodeId, props) =>
      `Step Functions state machine "${nodeId}" has maxRecursionDepth of ${props['maxRecursionDepth']} which exceeds safe limit of 50. Refactor into separate state machines.`,
  },
  {
    platform: 'aws-secretsmanager',
    rule: getRuleById('secrets-rotation-disabled')!,
    failsWhen: (props) => props['rotationEnabled'] !== true,
    formatMessage: (nodeId) =>
      `SecretsManager secret "${nodeId}" does not have automatic rotation enabled.`,
  },
  {
    platform: 'aws-kms',
    rule: getRuleById('kms-key-rotation-disabled')!,
    failsWhen: (props) => {
      const keySpec = (props['keySpec'] as string) ?? 'SYMMETRIC_DEFAULT';
      return (
        keySpec === 'SYMMETRIC_DEFAULT' && props['enableKeyRotation'] !== true
      );
    },
    formatMessage: (nodeId) =>
      `KMS key "${nodeId}" does not have automatic key rotation enabled.`,
  },
  {
    platform: 'aws-elasticache',
    rule: getRuleById('elasticache-encryption-disabled')!,
    failsWhen: (props) =>
      props['atRestEncryptionEnabled'] !== true ||
      props['transitEncryptionEnabled'] !== true,
    formatMessage: (nodeId) =>
      `ElastiCache replication group "${nodeId}" does not have both at-rest and in-transit encryption enabled.`,
  },
  {
    platform: 'aws-elasticache',
    rule: getRuleById('elasticache-auth-disabled')!,
    failsWhen: (props) =>
      props['transitEncryptionEnabled'] !== true || !props['authToken'],
    formatMessage: (nodeId) =>
      `ElastiCache replication group "${nodeId}" does not have AUTH token configured with transit encryption.`,
  },
  {
    platform: 'aws-budgets',
    rule: getRuleById('budget-threshold-missing')!,
    failsWhen: (props) =>
      !props['thresholdPercentage'] && !props['notificationTopicArn'],
    formatMessage: (nodeId) =>
      `Budget "${nodeId}" does not have a notification threshold or SNS topic configured.`,
  },
  {
    platform: 'aws-bedrock',
    rule: getRuleById('bedrock-guardrails-disabled')!,
    failsWhen: (props) => props['guardrailEnabled'] !== true,
    formatMessage: (nodeId) =>
      `Bedrock configuration "${nodeId}" does not have guardrails enabled.`,
  },
  {
    platform: 'aws-sagemaker-batch-transform',
    rule: getRuleById('sagemaker-vpc-disabled')!,
    failsWhen: (props) => {
      const vpcConfig = props['vpcConfig'] as
        | Record<string, unknown>
        | undefined;
      if (!vpcConfig) return true;
      const subnetIds = vpcConfig['subnetIds'] as unknown[] | undefined;
      return !subnetIds || subnetIds.length === 0;
    },
    formatMessage: (nodeId) =>
      `SageMaker model "${nodeId}" is not configured within a VPC.`,
  },
  {
    platform: 'aws-opensearch',
    rule: getRuleById('opensearch-encryption-disabled')!,
    failsWhen: (props) =>
      props['encryptionAtRest'] !== true ||
      props['nodeToNodeEncryption'] !== true,
    formatMessage: (nodeId) =>
      `OpenSearch domain "${nodeId}" does not have both at-rest and node-to-node encryption enabled.`,
  },
  {
    platform: 'aws-opensearch',
    rule: getRuleById('opensearch-public-access')!,
    failsWhen: (props) => props['publicAccess'] === true,
    formatMessage: (nodeId) =>
      `OpenSearch domain "${nodeId}" is publicly accessible. Use VPC endpoints.`,
  },
  {
    platform: 'aws-opensearch-serverless',
    rule: getRuleById('opensearch-public-access')!,
    failsWhen: (props) => props['publicAccess'] === true,
    formatMessage: (nodeId) =>
      `OpenSearch Serverless collection "${nodeId}" is publicly accessible. Use VPC endpoints.`,
  },
  {
    platform: 'aws-kinesis-firehose',
    rule: getRuleById('firehose-encryption-disabled')!,
    failsWhen: (props) => props['encryptionEnabled'] !== true,
    formatMessage: (nodeId) =>
      `Kinesis Firehose delivery stream "${nodeId}" does not have server-side encryption enabled.`,
  },
  {
    platform: 'aws-rds-cluster',
    rule: getRuleById('rds-encryption-disabled')!,
    failsWhen: (props) => props['storageEncrypted'] !== true,
    formatMessage: (nodeId) =>
      `RDS cluster "${nodeId}" does not have storage encryption enabled.`,
  },
  {
    platform: 'aws-rds-cluster',
    rule: getRuleById('rds-public-access')!,
    failsWhen: (props) => props['publicAccess'] === true,
    formatMessage: (nodeId) =>
      `RDS cluster "${nodeId}" is publicly accessible. Use VPC private subnets and RDS Proxy.`,
  },
  {
    platform: 'aws-sagemaker-endpoint',
    rule: getRuleById('sagemaker-vpc-disabled')!,
    failsWhen: (props) => {
      const vpcConfig = props['vpcConfig'] as
        | Record<string, unknown>
        | undefined;
      if (!vpcConfig) return true;
      const subnetIds = vpcConfig['subnetIds'] as unknown[] | undefined;
      return !subnetIds || subnetIds.length === 0;
    },
    formatMessage: (nodeId) =>
      `SageMaker endpoint "${nodeId}" is not configured within a VPC.`,
  },
  {
    platform: 'aws-cloudtrail',
    rule: getRuleById('cloudtrail-log-validation-disabled')!,
    failsWhen: (props) => props['enableLogFileValidation'] !== true,
    formatMessage: (nodeId) =>
      `CloudTrail trail "${nodeId}" does not have log file validation enabled.`,
  },
  {
    platform: 'aws-guardduty',
    rule: getRuleById('guardduty-not-enabled')!,
    failsWhen: (props) => props['enabled'] === false,
    formatMessage: (nodeId) => `GuardDuty detector "${nodeId}" is not enabled.`,
  },
  {
    platform: 'aws-glue-job',
    rule: getRuleById('glue-job-security-config-missing')!,
    failsWhen: (props) => props['securityConfiguration'] === undefined,
    formatMessage: (nodeId) =>
      `Glue job "${nodeId}" does not have a security configuration set.`,
  },
  {
    platform: 'aws-athena-workgroup',
    rule: getRuleById('athena-workgroup-encryption-disabled')!,
    failsWhen: (props) => {
      const opt = props['encryptionOption'] as string | undefined;
      return !opt || opt === 'NONE';
    },
    formatMessage: (nodeId) =>
      `Athena workgroup "${nodeId}" does not have result encryption enabled.`,
  },
  {
    platform: 'aws-athena-workgroup',
    rule: getRuleById('athena-workgroup-bytes-limit-missing')!,
    failsWhen: (props) => props['bytesScannedCutoffPerQuery'] === undefined,
    formatMessage: (nodeId) =>
      `Athena workgroup "${nodeId}" does not have a bytes scanned cutoff configured.`,
  },
  {
    platform: 'aws-sagemaker-pipeline',
    rule: getRuleById('sagemaker-pipeline-parallelism-missing')!,
    failsWhen: (props) => props['parallelismConfiguration'] === undefined,
    formatMessage: (nodeId) =>
      `SageMaker pipeline "${nodeId}" does not have parallelism configuration set.`,
  },
  {
    platform: 'aws-msk-cluster',
    rule: getRuleById('msk-encryption-in-transit-disabled')!,
    failsWhen: (props) => {
      const enc = props['encryptionInTransit'] as string | undefined;
      return enc !== undefined && enc !== 'TLS';
    },
    formatMessage: (nodeId) =>
      `MSK cluster "${nodeId}" does not use TLS for client-broker communication.`,
  },
  {
    platform: 'aws-msk-cluster',
    rule: getRuleById('msk-authentication-disabled')!,
    failsWhen: (props) => {
      const auth = props['clientAuthentication'] as
        | Record<string, unknown>
        | undefined;
      if (!auth) return true;
      const sasl = auth['sasl'] as Record<string, unknown> | undefined;
      const tls = auth['tls'] as unknown;
      const hasSaslIam = sasl?.['iam'] === true;
      const hasSaslScram = sasl?.['scram'] === true;
      const hasTls = tls !== undefined && tls !== false;
      return !hasSaslIam && !hasSaslScram && !hasTls;
    },
    formatMessage: (nodeId) =>
      `MSK cluster "${nodeId}" does not have client authentication enabled.`,
  },
  {
    platform: 'aws-transit-gateway',
    rule: getRuleById('transit-gateway-auto-accept-enabled')!,
    failsWhen: (props) => props['autoAcceptSharedAttachments'] === 'enable',
    formatMessage: (nodeId) =>
      `Transit gateway "${nodeId}" has auto-accept shared attachments enabled.`,
  },
  {
    platform: 'aws-network-firewall',
    rule: getRuleById('network-firewall-logging-disabled')!,
    failsWhen: (props) => props['loggingEnabled'] === false,
    formatMessage: (nodeId) =>
      `Network Firewall "${nodeId}" does not have logging enabled.`,
  },
  {
    platform: 'aws-route53-zone',
    rule: getRuleById('route53-health-check-missing')!,
    failsWhen: (props) => {
      const isPrivate = props['isPrivate'] === true;
      if (isPrivate) return false;
      return !props['healthCheck'];
    },
    formatMessage: (nodeId) =>
      `Public Route53 zone "${nodeId}" does not have a health check configured.`,
  },
  {
    platform: 'aws-eks-gpu-node-group',
    rule: getRuleById('eks-gpu-spot-capacity')!,
    failsWhen: (props) => props['capacityType'] === 'SPOT',
    formatMessage: (nodeId) =>
      `EKS GPU node group "${nodeId}" uses SPOT capacity. Use ON_DEMAND for production GPU workloads.`,
  },
  {
    platform: 'aws-eks-addon',
    rule: getRuleById('eks-addon-version-unset')!,
    failsWhen: (props) => props['addonVersion'] === undefined,
    formatMessage: (nodeId) =>
      `EKS addon "${nodeId}" does not have a specific version pinned.`,
  },
];

/**
 * Policy evaluator that checks IAM and network intents against
 * Baseline, FedRAMP-Moderate, and FedRAMP-High rules.
 *
 * Rules are data (RULE_CATALOG); severity is data (SEVERITY_MAP).
 * No pack branching — KL-008 enforced.
 */
export class BaselinePolicyEvaluator implements IPolicyEvaluator {
  readonly id = 'baseline-policy-evaluator';
  readonly supportedPacks: ReadonlyArray<string> = [...SUPPORTED_PACKS];

  evaluate(context: PolicyEvaluationContext): ReadonlyArray<Violation> {
    const violations: Violation[] = [];

    for (const intent of context.intents) {
      if (intent.type === 'iam') {
        this.checkIamIntent(
          intent as IamIntent,
          context.policyPack,
          violations,
        );
      } else if (intent.type === 'network') {
        this.checkNetworkIntent(
          intent as NetworkIntent,
          context.policyPack,
          violations,
        );
      }
    }

    // Node-level checks: inspect graph snapshot for compute resource configuration
    this.checkComputeNodes(context, violations);

    // Exceptions (Standard 5): suppress rule/target matches declared in the
    // manifest, keeping suppressed records for audit. The evaluation date is
    // injected via config — the engine never reads the clock (KL-001).
    const { exceptions } = parsePolicyExceptions(context.config['exceptions']);
    if (exceptions.length > 0) {
      const evaluationDate =
        typeof context.config['evaluationDate'] === 'string'
          ? (context.config['evaluationDate'] as string)
          : '9999-12-31'; // no date injected: treat all exceptions as active
      return applyPolicyExceptions(
        violations,
        exceptions,
        context.policyPack,
        evaluationDate,
      );
    }

    return violations;
  }

  private checkIamIntent(
    intent: IamIntent,
    policyPack: string,
    violations: Violation[],
  ): void {
    const targetId = intent.sourceEdgeId;

    // Rule: iam-no-wildcard-resource
    if (intent.resource.scope === 'pattern' && RULE_IAM_WILDCARD) {
      violations.push(
        createViolation({
          ruleId: RULE_IAM_WILDCARD.ruleId,
          ruleName: RULE_IAM_WILDCARD.ruleName,
          severity: getSeverity(policyPack, RULE_IAM_WILDCARD.ruleId),
          target: { type: 'edge', id: targetId },
          message: `IAM intent on edge "${targetId}" uses pattern-scoped resource "${intent.resource.pattern ?? '*'}". Wildcard scopes violate least privilege.`,
          remediation: RULE_IAM_WILDCARD.remediation,
          policyPack,
        }),
      );
    }

    // Rule: iam-admin-access-review
    const hasAdmin = intent.actions.some((a) => a.level === 'admin');
    if (hasAdmin && RULE_IAM_ADMIN) {
      violations.push(
        createViolation({
          ruleId: RULE_IAM_ADMIN.ruleId,
          ruleName: RULE_IAM_ADMIN.ruleName,
          severity: getSeverity(policyPack, RULE_IAM_ADMIN.ruleId),
          target: { type: 'edge', id: targetId },
          message: `IAM intent on edge "${targetId}" grants admin-level access. Admin grants full control.`,
          remediation: RULE_IAM_ADMIN.remediation,
          policyPack,
        }),
      );
    }

    // Rule: iam-missing-conditions
    const isCrossService = intent.principal.nodeRef !== intent.resource.nodeRef;
    const hasConditions =
      intent.conditions !== undefined && intent.conditions.length > 0;
    if (isCrossService && !hasConditions && RULE_IAM_CONDITIONS) {
      violations.push(
        createViolation({
          ruleId: RULE_IAM_CONDITIONS.ruleId,
          ruleName: RULE_IAM_CONDITIONS.ruleName,
          severity: getSeverity(policyPack, RULE_IAM_CONDITIONS.ruleId),
          target: { type: 'edge', id: targetId },
          message: `IAM intent on edge "${targetId}" grants cross-service access (${intent.principal.nodeRef} → ${intent.resource.nodeRef}) without conditions.`,
          remediation: RULE_IAM_CONDITIONS.remediation,
          policyPack,
        }),
      );
    }
  }

  private checkNetworkIntent(
    intent: NetworkIntent,
    policyPack: string,
    violations: Violation[],
  ): void {
    // Rule: network-broad-protocol
    if (intent.protocol.protocol === 'any' && RULE_NETWORK_PROTOCOL) {
      const targetId = intent.sourceEdgeId;
      violations.push(
        createViolation({
          ruleId: RULE_NETWORK_PROTOCOL.ruleId,
          ruleName: RULE_NETWORK_PROTOCOL.ruleName,
          severity: getSeverity(policyPack, RULE_NETWORK_PROTOCOL.ruleId),
          target: { type: 'edge', id: targetId },
          message: `Network intent on edge "${targetId}" uses protocol "any". Specify "tcp" or "udp" instead.`,
          remediation: RULE_NETWORK_PROTOCOL.remediation,
          policyPack,
        }),
      );
    }
  }

  private checkComputeNodes(
    context: PolicyEvaluationContext,
    violations: Violation[],
  ): void {
    const { snapshot, policyPack } = context;

    for (const node of snapshot.nodes) {
      const platform = node.metadata.properties['platform'] as
        | string
        | undefined;
      if (!platform) continue;

      for (const check of NODE_RULE_CHECKS) {
        if (platform !== check.platform) continue;
        if (!check.failsWhen(node.metadata.properties)) continue;

        violations.push(
          createViolation({
            ruleId: check.rule.ruleId,
            ruleName: check.rule.ruleName,
            severity: getSeverity(policyPack, check.rule.ruleId),
            target: { type: 'node', id: node.id },
            message: check.formatMessage(node.id, node.metadata.properties),
            remediation: check.rule.remediation,
            policyPack,
          }),
        );
      }
    }
  }
}
