import type { Node } from "@shinobi/ir";
import type {
  LoweredResource,
  LoweringContext,
  NodeLowerer,
  ResolvedDeps,
} from "../types";
import { shortName, createStandardTags } from "./utils";

/**
 * Lowers a platform node with platform "aws-kms" →
 * KMS Key + optional Alias.
 */
export class KmsLowerer implements NodeLowerer {
  readonly platform = "aws-kms";

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

    const keyName = `${name}-key`;

    const keySpec = (props["keySpec"] as string) ?? "SYMMETRIC_DEFAULT";
    const enableKeyRotation = props["enableKeyRotation"] !== false; // default true
    const deletionWindowInDays =
      (props["deletionWindowInDays"] as number) ?? 30;

    resources.push({
      name: keyName,
      resourceType: "aws:kms:Key",
      properties: {
        description: `${serviceName}-${name}`,
        keyUsage: "ENCRYPT_DECRYPT",
        customerMasterKeySpec: keySpec,
        enableKeyRotation:
          keySpec === "SYMMETRIC_DEFAULT" ? enableKeyRotation : false,
        deletionWindowInDays,
        tags: createStandardTags(node.id, "aws-kms", extraTags),
      },
      sourceId: node.id,
      dependsOn: [],
    });

    // Alias (always created for discoverability)
    resources.push({
      name: `${name}-key-alias`,
      resourceType: "aws:kms:Alias",
      properties: {
        name: `alias/${serviceName}-${name}`,
        targetKeyId: { ref: keyName },
      },
      sourceId: node.id,
      dependsOn: [keyName],
    });

    return resources;
  }
}
