import type { GraphSnapshot } from "@shinobi/ir";
import { shortName } from "./utils";

/** Maps platform → resource suffix and default output field for config references. */
export const PLATFORM_REF_MAP: Record<
  string,
  { suffix: string; defaultField: string }
> = {
  "aws-sqs": { suffix: "queue", defaultField: "url" },
  "aws-dynamodb": { suffix: "table", defaultField: "name" },
  "aws-apigateway": { suffix: "api", defaultField: "" }, // uses caller-provided field
  "aws-s3": { suffix: "bucket", defaultField: "bucket" },
  "aws-sns": { suffix: "topic", defaultField: "arn" },
  "aws-cloudfront": { suffix: "distribution", defaultField: "domainName" },
  "aws-wafv2": { suffix: "waf", defaultField: "arn" },
  "aws-acm": { suffix: "cert", defaultField: "arn" },
  "aws-cloudfront-function": { suffix: "cf-function", defaultField: "arn" },
  "aws-eventbridge-scheduler": { suffix: "schedule", defaultField: "arn" },
  "aws-stepfunctions": { suffix: "state-machine", defaultField: "arn" },
  "aws-vpc": { suffix: "vpc", defaultField: "id" },
  "aws-subnet": { suffix: "subnet", defaultField: "id" },
  "aws-security-group": { suffix: "sg", defaultField: "id" },
  "aws-ecr": { suffix: "repo", defaultField: "repositoryUrl" },
  "aws-ecs-cluster": { suffix: "cluster", defaultField: "arn" },
  "aws-ecs-task-definition": { suffix: "task-def", defaultField: "arn" },
  "aws-ecs-service": { suffix: "service", defaultField: "arn" },
  "aws-alb": { suffix: "alb", defaultField: "dnsName" },
  "aws-eks-cluster": { suffix: "cluster", defaultField: "name" },
  "aws-eks-node-group": { suffix: "node-group", defaultField: "arn" },
  "aws-secretsmanager": { suffix: "secret", defaultField: "arn" },
  "aws-kms": { suffix: "key", defaultField: "arn" },
  "aws-elasticache": {
    suffix: "redis",
    defaultField: "primaryEndpointAddress",
  },
  "aws-budgets": { suffix: "budget", defaultField: "id" },
  "aws-config-rules": { suffix: "config-rule", defaultField: "arn" },
  "aws-bedrock": { suffix: "bedrock-guardrail", defaultField: "guardrailArn" },
  "aws-sagemaker-batch-transform": { suffix: "model", defaultField: "arn" },
  "aws-opensearch": { suffix: "domain", defaultField: "endpoint" },
  "aws-kinesis-firehose": { suffix: "firehose", defaultField: "arn" },
  "aws-log-subscription-filter": {
    suffix: "log-sub-filter",
    defaultField: "name",
  },
  "aws-opensearch-serverless": {
    suffix: "collection",
    defaultField: "collectionEndpoint",
  },
  "aws-rds-cluster": { suffix: "rds-cluster", defaultField: "endpoint" },
  "aws-rds-proxy": { suffix: "rds-proxy", defaultField: "endpoint" },
  "aws-sagemaker-endpoint": { suffix: "sm-endpoint", defaultField: "arn" },
  "aws-config-recorder": { suffix: "config-recorder", defaultField: "id" },
  "aws-securityhub": { suffix: "securityhub", defaultField: "id" },
  "aws-guardduty": { suffix: "guardduty-detector", defaultField: "id" },
  "aws-cloudtrail": { suffix: "trail", defaultField: "arn" },
  "aws-glue-catalog": { suffix: "database", defaultField: "name" },
  "aws-glue-job": { suffix: "job", defaultField: "name" },
  "aws-glue-crawler": { suffix: "crawler", defaultField: "name" },
  "aws-athena-workgroup": { suffix: "workgroup", defaultField: "name" },
  "aws-sagemaker-pipeline": { suffix: "pipeline", defaultField: "arn" },
  "aws-msk-cluster": {
    suffix: "msk-cluster",
    defaultField: "bootstrapBrokersTls",
  },
  "aws-msk-configuration": { suffix: "msk-config", defaultField: "arn" },
  "aws-transit-gateway": { suffix: "tgw", defaultField: "id" },
  "aws-tgw-vpc-attachment": { suffix: "tgw-attachment", defaultField: "id" },
  "aws-nat-gateway": { suffix: "nat", defaultField: "publicIp" },
  "aws-network-firewall": { suffix: "fw", defaultField: "arn" },
  "aws-route53-zone": { suffix: "zone", defaultField: "zoneId" },
  "aws-route53-record": { suffix: "record", defaultField: "fqdn" },
  "aws-eks-addon": { suffix: "addon", defaultField: "arn" },
  "aws-eks-gpu-node-group": { suffix: "gpu-node-group", defaultField: "arn" },
};

function resolveNode(snapshot: GraphSnapshot, nodeRef: string) {
  return (
    snapshot.nodes.find((n) => n.id === nodeRef) ??
    snapshot.nodes.find((n) => n.id === `platform:${nodeRef}`) ??
    snapshot.nodes.find((n) => n.id === `component:${nodeRef}`)
  );
}

/**
 * Converts a logical config reference (nodeRef + field) into an adapter resource ref.
 * Keeps fallback behavior deterministic when a node cannot be resolved.
 */
export function resolveConfigReference(
  snapshot: GraphSnapshot,
  nodeRef: string,
  field: string,
): { ref: string } {
  const targetNode = resolveNode(snapshot, nodeRef);
  if (!targetNode) {
    return { ref: `${nodeRef}.${field}` };
  }

  const platform = targetNode.metadata.properties["platform"] as
    | string
    | undefined;
  const name = shortName(targetNode.id);

  if (platform) {
    const mapping = PLATFORM_REF_MAP[platform];
    if (mapping) {
      const outputField = mapping.defaultField || field;
      return { ref: `${name}-${mapping.suffix}.${outputField}` };
    }
  }

  return { ref: `${nodeRef}.${field}` };
}
