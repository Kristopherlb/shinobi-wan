import type { Node } from "@shinobi/ir";
import type {
  LoweredResource,
  LoweringContext,
  NodeLowerer,
  ResolvedDeps,
} from "../types";
import { shortName, createStandardTags, makeResourceName } from "./utils";

/**
 * Lowers a platform node with platform "aws-eks-gpu-node-group" ->
 * EKS GPU Node Group (same Pulumi type as standard NodeGroup).
 */
export class EksGpuNodeGroupLowerer implements NodeLowerer {
  readonly platform = "aws-eks-gpu-node-group";

  lower(
    node: Node,
    context: LoweringContext,
    _resolvedDeps: ResolvedDeps,
  ): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const config = node.metadata.properties;
    const extraTags = config["tags"] as Record<string, string> | undefined;
    const tags = createStandardTags(
      node.id,
      "aws-eks-gpu-node-group",
      extraTags,
    );

    const nodeGroupName = `${name}-gpu-node-group`;

    const clusterRef = config["clusterRef"] as string | undefined;
    const instanceTypes = Array.isArray(config["instanceTypes"])
      ? (config["instanceTypes"] as string[])
      : ["g5.xlarge"];
    const scalingConfig = (config["scalingConfig"] as Record<
      string,
      number
    >) ?? {
      desiredSize: 1,
      minSize: 0,
      maxSize: 4,
    };
    const amiType = (config["amiType"] as string) ?? "AL2_x86_64_GPU";
    const diskSize = (config["diskSize"] as number) ?? 100;
    const capacityType = (config["capacityType"] as string) ?? "ON_DEMAND";
    const labels = (config["labels"] as Record<string, string>) ?? {
      "nvidia.com/gpu": "true",
    };
    const taints = Array.isArray(config["taints"])
      ? (config["taints"] as Record<string, unknown>[])
      : [{ key: "nvidia.com/gpu", value: "true", effect: "NO_SCHEDULE" }];
    const nodeRoleArn = config["nodeRoleArn"] as string | undefined;

    // Build subnet refs
    const subnetIds = Array.isArray(config["subnetIds"])
      ? (config["subnetIds"] as string[]).map((s) => ({
          ref: `${shortName(s)}-subnet`,
        }))
      : [];

    const properties: Record<string, unknown> = {
      nodeGroupName: makeResourceName(
        node.id,
        context.adapterConfig.serviceName,
      ),
      instanceTypes,
      scalingConfig,
      amiType,
      diskSize,
      capacityType,
      labels,
      taints,
      subnetIds,
      tags,
    };

    if (clusterRef) {
      properties.clusterName = { ref: `${shortName(clusterRef)}-cluster.name` };
    }
    if (nodeRoleArn) properties.nodeRoleArn = nodeRoleArn;

    return [
      {
        name: nodeGroupName,
        resourceType: "aws:eks:NodeGroup",
        properties,
        sourceId: node.id,
        dependsOn: [],
      },
    ];
  }
}
