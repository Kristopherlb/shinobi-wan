import type { Node } from "@shinobi/ir";
import type {
  LoweredResource,
  LoweringContext,
  NodeLowerer,
  ResolvedDeps,
} from "../types";
import { shortName, createStandardTags, makeResourceName } from "./utils";

/**
 * Lowers a platform node with platform "aws-msk-configuration" -> MSK Configuration.
 */
export class MskConfigurationLowerer implements NodeLowerer {
  readonly platform = "aws-msk-configuration";

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
      "aws-msk-configuration",
      extraTags,
    );

    const configName = `${name}-msk-config`;

    const kafkaVersions = Array.isArray(config["kafkaVersions"])
      ? (config["kafkaVersions"] as string[])
      : ["3.5.1"];
    const serverProperties = (config["serverProperties"] as string) ?? "";

    return [
      {
        name: configName,
        resourceType: "aws:msk:Configuration",
        properties: {
          name: makeResourceName(node.id, context.adapterConfig.serviceName),
          kafkaVersions,
          serverProperties,
          tags,
        },
        sourceId: node.id,
        dependsOn: [],
      },
    ];
  }
}
