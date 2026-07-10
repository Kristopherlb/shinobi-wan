import type { Node } from "@shinobi/ir";
import type {
  LoweredResource,
  LoweringContext,
  NodeLowerer,
  ResolvedDeps,
} from "../types";
import { shortName, createStandardTags } from "./utils";

/**
 * Lowers a platform node with platform "aws-kinesis-firehose" →
 * Kinesis Firehose Delivery Stream.
 */
export class KinesisFirehoseLowerer implements NodeLowerer {
  readonly platform = "aws-kinesis-firehose";

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

    const firehoseName = `${name}-firehose`;

    const destinationType =
      (props["destinationType"] as string) ?? "opensearch";
    const s3BackupMode =
      (props["s3BackupMode"] as string) ?? "FailedDocumentsOnly";
    const bufferingIntervalSeconds =
      (props["bufferingIntervalSeconds"] as number) ?? 60;
    const bufferingSizeMBs = (props["bufferingSizeMBs"] as number) ?? 5;
    const encryptionEnabled = props["encryptionEnabled"] === true;
    const indexName = props["indexName"] as string | undefined;

    const firehoseProperties: Record<string, unknown> = {
      name: `${serviceName}-${name}`,
      tags: createStandardTags(node.id, "aws-kinesis-firehose", extraTags),
    };

    if (destinationType === "opensearch") {
      firehoseProperties["destination"] = "opensearch";
      const opensearchConfig: Record<string, unknown> = {
        s3BackupMode,
        bufferingHints: {
          intervalInSeconds: bufferingIntervalSeconds,
          sizeInMBs: bufferingSizeMBs,
        },
      };
      if (props["opensearchDomainArn"]) {
        opensearchConfig["domainArn"] = props["opensearchDomainArn"];
      }
      if (indexName) {
        opensearchConfig["indexName"] = indexName;
      }
      if (props["s3BucketArn"]) {
        opensearchConfig["s3Configuration"] = {
          bucketArn: props["s3BucketArn"],
        };
      }
      firehoseProperties["opensearchConfiguration"] = opensearchConfig;
    } else {
      firehoseProperties["destination"] = "extended_s3";
      const s3Config: Record<string, unknown> = {
        bufferingHints: {
          intervalInSeconds: bufferingIntervalSeconds,
          sizeInMBs: bufferingSizeMBs,
        },
      };
      if (props["s3BucketArn"]) {
        s3Config["bucketArn"] = props["s3BucketArn"];
      }
      firehoseProperties["extendedS3Configuration"] = s3Config;
    }

    if (encryptionEnabled) {
      firehoseProperties["serverSideEncryption"] = {
        enabled: true,
        keyType: "AWS_OWNED_CMK",
      };
    }

    resources.push({
      name: firehoseName,
      resourceType: "aws:kinesis:FirehoseDeliveryStream",
      properties: firehoseProperties,
      sourceId: node.id,
      dependsOn: [],
    });

    return resources;
  }
}
