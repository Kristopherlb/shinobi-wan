import type { Node } from "@shinobi/ir";
import type {
  LoweredResource,
  LoweringContext,
  NodeLowerer,
  ResolvedDeps,
} from "../types";
import { shortName, createStandardTags, makeResourceName } from "./utils";

/**
 * Lowers a platform node with platform "aws-msk-cluster" ->
 * MSK Cluster + CloudWatch Log Group.
 */
export class MskClusterLowerer implements NodeLowerer {
  readonly platform = "aws-msk-cluster";

  lower(
    node: Node,
    context: LoweringContext,
    _resolvedDeps: ResolvedDeps,
  ): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const config = node.metadata.properties;
    const extraTags = config["tags"] as Record<string, string> | undefined;
    const tags = createStandardTags(node.id, "aws-msk-cluster", extraTags);

    const clusterName = `${name}-msk-cluster`;
    const logGroupName = `${name}-msk-log-group`;

    const kafkaVersion = (config["kafkaVersion"] as string) ?? "3.5.1";
    const numberOfBrokerNodes = (config["numberOfBrokerNodes"] as number) ?? 3;
    const instanceType = (config["instanceType"] as string) ?? "kafka.m5.large";
    const ebsVolumeSize = (config["ebsVolumeSize"] as number) ?? 100;
    const encryptionInTransit =
      (config["encryptionInTransit"] as string) ?? "TLS";
    const encryptionAtRest = config["encryptionAtRest"] !== false;
    const kmsKeyArn = config["kmsKeyArn"] as string | undefined;
    const enhancedMonitoring =
      (config["enhancedMonitoring"] as string) ?? "PER_TOPIC_PER_BROKER";
    const clientAuthentication = config["clientAuthentication"] as
      | Record<string, unknown>
      | undefined;
    const cloudwatchLogsEnabled = config["cloudwatchLogsEnabled"] !== false;

    // Build subnet refs
    const subnetIds = Array.isArray(config["subnetIds"])
      ? (config["subnetIds"] as string[]).map((s) => ({
          ref: `${shortName(s)}-subnet`,
        }))
      : [];

    // Build security group refs
    const securityGroupIds = Array.isArray(config["securityGroupIds"])
      ? (config["securityGroupIds"] as string[]).map((s) => ({
          ref: `${shortName(s)}-sg`,
        }))
      : [];

    const brokerNodeGroupInfo: Record<string, unknown> = {
      instanceType,
      clientSubnets: subnetIds,
      securityGroups: securityGroupIds,
      storageInfo: {
        ebsStorageInfo: { volumeSize: ebsVolumeSize },
      },
    };

    const encryptionInfo: Record<string, unknown> = {
      encryptionInTransit: { clientBroker: encryptionInTransit },
      encryptionAtRestKmsKeyArn: encryptionAtRest,
    };
    if (kmsKeyArn) encryptionInfo.encryptionAtRestKmsKeyArn = kmsKeyArn;

    const clusterProperties: Record<string, unknown> = {
      clusterName: makeResourceName(node.id, context.adapterConfig.serviceName),
      kafkaVersion,
      numberOfBrokerNodes,
      brokerNodeGroupInfo,
      encryptionInfo,
      enhancedMonitoring,
      tags,
    };

    if (clientAuthentication)
      clusterProperties.clientAuthentication = clientAuthentication;

    if (cloudwatchLogsEnabled) {
      clusterProperties.loggingInfo = {
        brokerLogs: {
          cloudwatchLogs: {
            enabled: true,
            logGroup: { ref: logGroupName },
          },
        },
      };
    }

    // Optional config ref
    const configRef = config["configurationRef"] as string | undefined;
    if (configRef) {
      clusterProperties.configurationInfo = {
        arn: { ref: `${shortName(configRef)}-msk-config` },
        revision: 1,
      };
    }

    const resources: LoweredResource[] = [];

    resources.push({
      name: logGroupName,
      resourceType: "aws:cloudwatch:LogGroup",
      properties: {
        name: `/aws/msk/${makeResourceName(node.id, context.adapterConfig.serviceName)}`,
        tags,
      },
      sourceId: node.id,
      dependsOn: [],
    });

    resources.push({
      name: clusterName,
      resourceType: "aws:msk:Cluster",
      properties: clusterProperties,
      sourceId: node.id,
      dependsOn: cloudwatchLogsEnabled ? [logGroupName] : [],
    });

    return resources;
  }
}
