import type { Node } from "@shinobi/ir";
import type {
  LoweredResource,
  LoweringContext,
  NodeLowerer,
  ResolvedDeps,
} from "../types";
import { shortName, createStandardTags } from "./utils";

/**
 * Lowers a platform node with platform "aws-tgw-vpc-attachment" ->
 * Transit Gateway VPC Attachment.
 */
export class TgwVpcAttachmentLowerer implements NodeLowerer {
  readonly platform = "aws-tgw-vpc-attachment";

  lower(
    node: Node,
    _context: LoweringContext,
    _resolvedDeps: ResolvedDeps,
  ): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const config = node.metadata.properties;
    const extraTags = config["tags"] as Record<string, string> | undefined;
    const tags = createStandardTags(
      node.id,
      "aws-tgw-vpc-attachment",
      extraTags,
    );

    const attachmentName = `${name}-tgw-attachment`;

    const transitGatewayRef = config["transitGatewayRef"] as string | undefined;
    const vpcRef = config["vpcRef"] as string | undefined;
    const dnsSupport = (config["dnsSupport"] as string) ?? "enable";
    const ipv6Support = (config["ipv6Support"] as string) ?? "disable";

    // Build subnet refs
    const subnetIds = Array.isArray(config["subnetIds"])
      ? (config["subnetIds"] as string[]).map((s) => ({
          ref: `${shortName(s)}-subnet`,
        }))
      : [];

    const properties: Record<string, unknown> = {
      subnetIds,
      dnsSupport,
      ipv6Support,
      tags,
    };

    if (transitGatewayRef) {
      properties.transitGatewayId = {
        ref: `${shortName(transitGatewayRef)}-tgw`,
      };
    }
    if (vpcRef) {
      properties.vpcId = { ref: `${shortName(vpcRef)}-vpc` };
    }

    return [
      {
        name: attachmentName,
        resourceType: "aws:ec2transitgateway:VpcAttachment",
        properties,
        sourceId: node.id,
        dependsOn: [],
      },
    ];
  }
}
