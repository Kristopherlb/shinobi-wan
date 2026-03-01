import type { Violation, IamIntent, NetworkIntent } from '@shinobi/contracts';
import type { IPolicyEvaluator, PolicyEvaluationContext } from '@shinobi/kernel';
import { SUPPORTED_PACKS } from '../severity-map';
import { getSeverity } from '../severity-map';
import { getRuleById, type PolicyRule } from '../rules';
import { createViolation } from '../violation-factory';

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
  readonly formatMessage: (nodeId: string, properties: Record<string, unknown>) => string;
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
    failsWhen: (props) => typeof props['timeout'] === 'number' && (props['timeout'] as number) > 900,
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
      return typeof props['minimumProtocolVersion'] === 'string' && weakProtocols.includes(props['minimumProtocolVersion']);
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
    failsWhen: (props) => props['logging'] === false || props['logging'] === undefined,
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
        this.checkIamIntent(intent as IamIntent, context.policyPack, violations);
      } else if (intent.type === 'network') {
        this.checkNetworkIntent(intent as NetworkIntent, context.policyPack, violations);
      }
    }

    // Node-level checks: inspect graph snapshot for compute resource configuration
    this.checkComputeNodes(context, violations);

    return violations;
  }

  private checkIamIntent(
    intent: IamIntent,
    policyPack: string,
    violations: Violation[]
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
        })
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
        })
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
        })
      );
    }
  }

  private checkNetworkIntent(
    intent: NetworkIntent,
    policyPack: string,
    violations: Violation[]
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
        })
      );
    }
  }

  private checkComputeNodes(
    context: PolicyEvaluationContext,
    violations: Violation[]
  ): void {
    const { snapshot, policyPack } = context;

    for (const node of snapshot.nodes) {
      const platform = node.metadata.properties['platform'] as string | undefined;
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
          })
        );
      }
    }
  }
}
