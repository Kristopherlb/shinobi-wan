import { describe, it, expect } from "vitest";
import { createTestNode } from "@shinobi/ir";
import { makeDefaultContext, makeDefaultDeps } from "./test-helpers";
import { AthenaWorkgroupLowerer } from "../lowerers/athena-workgroup-lowerer";

const DEFAULT_CONTEXT = makeDefaultContext();
const DEFAULT_DEPS = makeDefaultDeps();

describe("AthenaWorkgroupLowerer", () => {
  const lowerer = new AthenaWorkgroupLowerer();

  it("should emit 1 resource (workgroup)", () => {
    const node = createTestNode({
      id: "platform:query-workgroup",
      type: "platform",
      metadata: {
        properties: {
          platform: "aws-athena-workgroup",
          outputLocation: "s3://query-results/",
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result).toHaveLength(1);
    expect(result[0]?.resourceType).toBe("aws:athena:Workgroup");
    expect(result[0]?.name).toBe("query-workgroup-workgroup");
  });

  it("should use default encryption option SSE_S3", () => {
    const node = createTestNode({
      id: "platform:workgroup",
      type: "platform",
      metadata: { properties: { platform: "aws-athena-workgroup" } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const config = result[0]?.properties?.configuration as Record<
      string,
      unknown
    >;
    const resultConfig = config?.resultConfiguration as Record<string, unknown>;
    const encryption = resultConfig?.encryptionConfiguration as Record<
      string,
      unknown
    >;
    expect(encryption?.encryptionOption).toBe("SSE_S3");
  });

  it("should respect custom encryption with KMS", () => {
    const node = createTestNode({
      id: "platform:workgroup",
      type: "platform",
      metadata: {
        properties: {
          platform: "aws-athena-workgroup",
          encryptionOption: "SSE_KMS",
          kmsKeyArn: "arn:aws:kms:us-east-1:123456789012:key/12345",
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const config = result[0]?.properties?.configuration as Record<
      string,
      unknown
    >;
    const resultConfig = config?.resultConfiguration as Record<string, unknown>;
    const encryption = resultConfig?.encryptionConfiguration as Record<
      string,
      unknown
    >;
    expect(encryption?.encryptionOption).toBe("SSE_KMS");
    expect(encryption?.kmsKeyArn).toBe(
      "arn:aws:kms:us-east-1:123456789012:key/12345",
    );
  });

  it("should default to enforcing workgroup configuration", () => {
    const node = createTestNode({
      id: "platform:workgroup",
      type: "platform",
      metadata: { properties: { platform: "aws-athena-workgroup" } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const config = result[0]?.properties?.configuration as Record<
      string,
      unknown
    >;
    expect(config?.enforceWorkgroupConfiguration).toBe(true);
    expect(config?.publishCloudWatchMetricsEnabled).toBe(true);
    expect(config?.requesterPaysEnabled).toBe(false);
  });

  it("should include bytes scanned cutoff when provided", () => {
    const node = createTestNode({
      id: "platform:workgroup",
      type: "platform",
      metadata: {
        properties: {
          platform: "aws-athena-workgroup",
          bytesScannedCutoffPerQuery: 1073741824, // 1 GB
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const config = result[0]?.properties?.configuration as Record<
      string,
      unknown
    >;
    expect(config?.bytesScannedCutoffPerQuery).toBe(1073741824);
  });

  it("should omit bytes scanned cutoff when not provided", () => {
    const node = createTestNode({
      id: "platform:workgroup",
      type: "platform",
      metadata: { properties: { platform: "aws-athena-workgroup" } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const config = result[0]?.properties?.configuration as Record<
      string,
      unknown
    >;
    expect(config?.bytesScannedCutoffPerQuery).toBeUndefined();
  });

  it("should include output location in result configuration", () => {
    const node = createTestNode({
      id: "platform:workgroup",
      type: "platform",
      metadata: {
        properties: {
          platform: "aws-athena-workgroup",
          outputLocation: "s3://my-bucket/athena-results/",
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const config = result[0]?.properties?.configuration as Record<
      string,
      unknown
    >;
    const resultConfig = config?.resultConfiguration as Record<string, unknown>;
    expect(resultConfig?.outputLocation).toBe("s3://my-bucket/athena-results/");
  });

  it("should include standard tags", () => {
    const node = createTestNode({
      id: "platform:workgroup",
      type: "platform",
      metadata: { properties: { platform: "aws-athena-workgroup" } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = result[0]?.properties?.tags as Record<string, string>;
    expect(tags?.["shinobi:platform"]).toBe("aws-athena-workgroup");
  });

  it("should merge custom tags", () => {
    const node = createTestNode({
      id: "platform:workgroup",
      type: "platform",
      metadata: {
        properties: {
          platform: "aws-athena-workgroup",
          tags: { team: "data-engineering" },
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = result[0]?.properties?.tags as Record<string, string>;
    expect(tags?.team).toBe("data-engineering");
  });
});
