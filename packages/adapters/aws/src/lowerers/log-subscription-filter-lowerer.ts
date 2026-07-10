import type { Node } from "@shinobi/ir";
import type {
  LoweredResource,
  LoweringContext,
  NodeLowerer,
  ResolvedDeps,
} from "../types";
import { shortName, createStandardTags } from "./utils";

/**
 * Lowers a platform node with platform "aws-log-subscription-filter" →
 * CloudWatch Log Subscription Filter.
 */
export class LogSubscriptionFilterLowerer implements NodeLowerer {
  readonly platform = "aws-log-subscription-filter";

  lower(
    node: Node,
    context: LoweringContext,
    _resolvedDeps: ResolvedDeps,
  ): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const props = node.metadata.properties;
    const serviceName = context.adapterConfig.serviceName;
    const extraTags = (props["tags"] as Record<string, string>) ?? {};

    const resources: LoweredResource[] = [];

    const filterName = `${name}-log-sub-filter`;

    const filterPattern = (props["filterPattern"] as string) ?? "";
    const distribution = (props["distribution"] as string) ?? "ByLogStream";

    const filterProperties: Record<string, unknown> = {
      name: `${serviceName}-${name}`,
      filterPattern,
      distribution,
      tags: createStandardTags(
        node.id,
        "aws-log-subscription-filter",
        extraTags,
      ),
    };

    if (props["logGroupName"]) {
      filterProperties["logGroupName"] = props["logGroupName"];
    }
    if (props["destinationArn"]) {
      filterProperties["destinationArn"] = props["destinationArn"];
    }

    resources.push({
      name: filterName,
      resourceType: "aws:cloudwatch:LogSubscriptionFilter",
      properties: filterProperties,
      sourceId: node.id,
      dependsOn: [],
    });

    return resources;
  }
}
