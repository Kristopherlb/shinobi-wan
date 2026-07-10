import type { Node } from "@shinobi/ir";
import type {
  LoweredResource,
  LoweringContext,
  NodeLowerer,
  ResolvedDeps,
} from "../types";
import { shortName, createStandardTags, makeResourceName } from "./utils";

/**
 * Lowers a platform node with platform "aws-eks-cluster" → EKS Cluster + CloudWatch Log Group.
 */
export class EksClusterLowerer implements NodeLowerer {
  readonly platform = "aws-eks-cluster";

  lower(
    node: Node,
    context: LoweringContext,
    _resolvedDeps: ResolvedDeps,
  ): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const config = node.metadata.properties;
    const extraTags = config["tags"] as Record<string, string> | undefined;
    const tags = createStandardTags(node.id, "aws-eks-cluster", extraTags);

    const clusterName = `${name}-cluster`;
    const logGroupName = `${name}-cluster-log-group`;

    const version = (config["version"] as string | undefined) ?? "1.29";
    const endpointPrivateAccess =
      config["endpointPrivateAccess"] !== undefined
        ? (config["endpointPrivateAccess"] as boolean)
        : true;
    const endpointPublicAccess =
      config["endpointPublicAccess"] !== undefined
        ? (config["endpointPublicAccess"] as boolean)
        : false;
    const enabledClusterLogTypes = Array.isArray(
      config["enabledClusterLogTypes"],
    )
      ? (config["enabledClusterLogTypes"] as string[])
      : ["api", "audit", "authenticator"];

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

    const clusterProperties: Record<string, unknown> = {
      name: makeResourceName(node.id, context.adapterConfig.serviceName),
      version,
      vpcConfig: {
        subnetIds,
        securityGroupIds,
        endpointPrivateAccess,
        endpointPublicAccess,
      },
      enabledClusterLogTypes,
      tags,
    };

    // Optional IAM role ref
    if (config["roleArn"]) {
      clusterProperties.roleArn = config["roleArn"];
    }

    const resources: LoweredResource[] = [];

    resources.push({
      name: clusterName,
      resourceType: "aws:eks:Cluster",
      properties: clusterProperties,
      sourceId: node.id,
      dependsOn: [],
    });

    resources.push({
      name: logGroupName,
      resourceType: "aws:cloudwatch:LogGroup",
      properties: {
        name: `/aws/eks/${makeResourceName(node.id, context.adapterConfig.serviceName)}/cluster`,
        tags,
      },
      sourceId: node.id,
      dependsOn: [],
    });

    return resources;
  }
}
