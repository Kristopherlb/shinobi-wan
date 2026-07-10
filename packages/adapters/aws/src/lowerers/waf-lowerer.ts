import type { Node } from "@shinobi/ir";
import type {
  LoweredResource,
  LoweringContext,
  NodeLowerer,
  ResolvedDeps,
} from "../types";
import { shortName, createStandardTags } from "./utils";

/**
 * Default managed rule groups for WAF v2.
 */
const DEFAULT_MANAGED_RULES: ReadonlyArray<{
  name: string;
  vendorName: string;
  priority: number;
}> = [
  { name: "AWSManagedRulesCommonRuleSet", vendorName: "AWS", priority: 10 },
  {
    name: "AWSManagedRulesKnownBadInputsRuleSet",
    vendorName: "AWS",
    priority: 20,
  },
  {
    name: "AWSManagedRulesAmazonIpReputationList",
    vendorName: "AWS",
    priority: 30,
  },
];

/**
 * Lowers a platform node with platform "aws-wafv2" → WAF v2 Web ACL.
 *
 * Emits:
 *   - WebAcl (with managed rule groups)
 */
export class WafLowerer implements NodeLowerer {
  readonly platform = "aws-wafv2";

  lower(
    node: Node,
    context: LoweringContext,
    _resolvedDeps: ResolvedDeps,
  ): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const props = node.metadata.properties;
    const serviceName = context.adapterConfig.serviceName;

    const resources: LoweredResource[] = [];

    const aclName = `${name}-waf`;

    // Determine scope (CLOUDFRONT or REGIONAL)
    const scope = (props["scope"] as string) ?? "CLOUDFRONT";
    const defaultAction = (props["defaultAction"] as string) ?? "allow";

    // Build managed rule group statements
    const customRules = props["managedRules"] as
      | ReadonlyArray<{
          name: string;
          vendorName: string;
          priority: number;
        }>
      | undefined;
    const managedRules = customRules ?? DEFAULT_MANAGED_RULES;

    const rules = managedRules.map((rule) => ({
      name: rule.name,
      priority: rule.priority,
      statement: {
        managedRuleGroupStatement: {
          name: rule.name,
          vendorName: rule.vendorName,
        },
      },
      overrideAction: { none: {} },
      visibilityConfig: {
        cloudwatchMetricsEnabled: true,
        metricName: `${serviceName}-${name}-${rule.name}`,
        sampledRequestsEnabled: true,
      },
    }));

    resources.push({
      name: aclName,
      resourceType: "aws:wafv2:WebAcl",
      properties: {
        name: `${serviceName}-${name}`,
        scope,
        defaultAction:
          defaultAction === "allow" ? { allow: {} } : { block: {} },
        rules,
        visibilityConfig: {
          cloudwatchMetricsEnabled: true,
          metricName: `${serviceName}-${name}`,
          sampledRequestsEnabled: true,
        },
        tags: createStandardTags(node.id, "aws-wafv2"),
      },
      sourceId: node.id,
      dependsOn: [],
    });

    return resources;
  }
}
