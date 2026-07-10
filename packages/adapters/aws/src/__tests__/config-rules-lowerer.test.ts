import { describe, it, expect } from "vitest";
import { ConfigRulesLowerer } from "../lowerers/config-rules-lowerer";
import { makeNode, makeDefaultContext, makeDefaultDeps } from "./test-helpers";

const DEFAULT_CONTEXT = makeDefaultContext({
  adapterConfig: { region: "us-east-1", serviceName: "my-service" },
});
const DEFAULT_DEPS = makeDefaultDeps();

describe("ConfigRulesLowerer", () => {
  const lowerer = new ConfigRulesLowerer();

  it("has correct platform", () => {
    expect(lowerer.platform).toBe("aws-config-rules");
  });

  it("produces Config Rule resource", () => {
    const node = makeNode({
      id: "platform:s3-encryption-check",
      type: "platform",
      metadata: { properties: { platform: "aws-config-rules" } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources).toHaveLength(1);
    expect(resources[0].resourceType).toBe("aws:cfg:Rule");
  });

  it("uses correct naming convention", () => {
    const node = makeNode({
      id: "platform:s3-encryption-check",
      type: "platform",
      metadata: { properties: { platform: "aws-config-rules" } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].name).toBe("s3-encryption-check-config-rule");
    expect(resources[0].properties["name"]).toBe(
      "my-service-s3-encryption-check",
    );
  });

  it("sets correct tags", () => {
    const node = makeNode({
      id: "platform:s3-check",
      type: "platform",
      metadata: { properties: { platform: "aws-config-rules" } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = resources[0].properties["tags"] as Record<string, string>;
    expect(tags["shinobi:node"]).toBe("platform:s3-check");
    expect(tags["shinobi:platform"]).toBe("aws-config-rules");
  });

  it("includes source config when provided", () => {
    const source = {
      owner: "AWS",
      sourceIdentifier: "S3_BUCKET_SERVER_SIDE_ENCRYPTION_ENABLED",
    };
    const node = makeNode({
      id: "platform:s3-check",
      type: "platform",
      metadata: { properties: { platform: "aws-config-rules", source } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].properties["source"]).toEqual(source);
  });

  it("includes inputParameters when provided as object", () => {
    const node = makeNode({
      id: "platform:check",
      type: "platform",
      metadata: {
        properties: {
          platform: "aws-config-rules",
          inputParameters: { key: "value" },
        },
      },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].properties["inputParameters"]).toBe('{"key":"value"}');
  });

  it("passes inputParameters as-is when string", () => {
    const node = makeNode({
      id: "platform:check",
      type: "platform",
      metadata: {
        properties: {
          platform: "aws-config-rules",
          inputParameters: '{"key":"value"}',
        },
      },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].properties["inputParameters"]).toBe('{"key":"value"}');
  });

  it("includes maximumExecutionFrequency when provided", () => {
    const node = makeNode({
      id: "platform:check",
      type: "platform",
      metadata: {
        properties: {
          platform: "aws-config-rules",
          maximumExecutionFrequency: "TwentyFour_Hours",
        },
      },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].properties["maximumExecutionFrequency"]).toBe(
      "TwentyFour_Hours",
    );
  });

  it("has no dependencies", () => {
    const node = makeNode({
      id: "platform:check",
      type: "platform",
      metadata: { properties: { platform: "aws-config-rules" } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].dependsOn).toEqual([]);
  });

  it("sets sourceId to node ID", () => {
    const node = makeNode({
      id: "platform:check",
      type: "platform",
      metadata: { properties: { platform: "aws-config-rules" } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].sourceId).toBe("platform:check");
  });

  it("output is deterministic", () => {
    const node = makeNode({
      id: "platform:check",
      type: "platform",
      metadata: { properties: { platform: "aws-config-rules" } },
    });

    const r1 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const r2 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});
