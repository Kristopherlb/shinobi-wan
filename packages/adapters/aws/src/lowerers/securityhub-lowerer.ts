import type { Node } from "@shinobi/ir";
import type {
  LoweredResource,
  LoweringContext,
  NodeLowerer,
  ResolvedDeps,
} from "../types";
import { shortName, createStandardTags } from "./utils";

/**
 * Lowers a platform node with platform "aws-securityhub" →
 * SecurityHub Account + optional StandardsSubscription.
 */
export class SecurityHubLowerer implements NodeLowerer {
  readonly platform = "aws-securityhub";

  lower(
    node: Node,
    context: LoweringContext,
    _resolvedDeps: ResolvedDeps,
  ): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const props = node.metadata.properties;
    const extraTags = (props["tags"] as Record<string, string>) ?? {};

    const resources: LoweredResource[] = [];

    const hubName = `${name}-securityhub`;

    // SecurityHub Account (enable)
    resources.push({
      name: hubName,
      resourceType: "aws:securityhub:Account",
      properties: {
        tags: createStandardTags(node.id, "aws-securityhub", extraTags),
      },
      sourceId: node.id,
      dependsOn: [],
    });

    // Optional Standards Subscription
    const enableDefaultStandards = props["enableDefaultStandards"] !== false;
    if (enableDefaultStandards) {
      const standardsArn =
        (props["standardsArn"] as string) ??
        "arn:aws:securityhub:::ruleset/cis-aws-foundations-benchmark/v/1.2.0";
      const standardName = `${name}-securityhub-standard`;

      resources.push({
        name: standardName,
        resourceType: "aws:securityhub:StandardsSubscription",
        properties: {
          standardsArn,
        },
        sourceId: node.id,
        dependsOn: [hubName],
      });
    }

    return resources;
  }
}
