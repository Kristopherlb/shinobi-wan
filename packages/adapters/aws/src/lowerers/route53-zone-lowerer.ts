import type { Node } from "@shinobi/ir";
import type {
  LoweredResource,
  LoweringContext,
  NodeLowerer,
  ResolvedDeps,
} from "../types";
import { shortName, createStandardTags } from "./utils";

/**
 * Lowers a platform node with platform "aws-route53-zone" ->
 * Route53 Hosted Zone + optional Health Check.
 */
export class Route53ZoneLowerer implements NodeLowerer {
  readonly platform = "aws-route53-zone";

  lower(
    node: Node,
    _context: LoweringContext,
    _resolvedDeps: ResolvedDeps,
  ): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const config = node.metadata.properties;
    const extraTags = config["tags"] as Record<string, string> | undefined;
    const tags = createStandardTags(node.id, "aws-route53-zone", extraTags);

    const zoneName = `${name}-zone`;

    const domainName = config["zoneName"] as string | undefined;
    const isPrivate = config["isPrivate"] === true;
    const vpcId = config["vpcId"] as string | undefined;
    const comment = config["comment"] as string | undefined;
    const healthCheck = config["healthCheck"] as
      | Record<string, unknown>
      | undefined;

    const resources: LoweredResource[] = [];

    const zoneProperties: Record<string, unknown> = {
      name: domainName,
      tags,
    };

    if (comment) zoneProperties.comment = comment;

    if (isPrivate && vpcId) {
      zoneProperties.vpcs = [{ vpcId: { ref: `${shortName(vpcId)}-vpc` } }];
    }

    resources.push({
      name: zoneName,
      resourceType: "aws:route53:Zone",
      properties: zoneProperties,
      sourceId: node.id,
      dependsOn: [],
    });

    if (healthCheck) {
      const healthCheckName = `${name}-health-check`;
      const hcProperties: Record<string, unknown> = {
        type: healthCheck["type"] ?? "HTTPS",
        tags,
      };

      if (healthCheck["fqdn"]) hcProperties.fqdn = healthCheck["fqdn"];
      if (healthCheck["port"]) hcProperties.port = healthCheck["port"];
      if (healthCheck["requestInterval"])
        hcProperties.requestInterval = healthCheck["requestInterval"];
      if (healthCheck["failureThreshold"])
        hcProperties.failureThreshold = healthCheck["failureThreshold"];

      resources.push({
        name: healthCheckName,
        resourceType: "aws:route53:HealthCheck",
        properties: hcProperties,
        sourceId: node.id,
        dependsOn: [],
      });
    }

    return resources;
  }
}
