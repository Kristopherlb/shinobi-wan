import { describe, it, expect } from "vitest";
import { KmsLowerer } from "../lowerers/kms-lowerer";
import { makeNode, makeDefaultContext, makeDefaultDeps } from "./test-helpers";

const DEFAULT_CONTEXT = makeDefaultContext({
  adapterConfig: { region: "us-east-1", serviceName: "my-service" },
});
const DEFAULT_DEPS = makeDefaultDeps();

describe("KmsLowerer", () => {
  const lowerer = new KmsLowerer();

  it("has correct platform", () => {
    expect(lowerer.platform).toBe("aws-kms");
  });

  it("produces Key + Alias resources", () => {
    const node = makeNode({
      id: "platform:encryption-key",
      type: "platform",
      metadata: { properties: { platform: "aws-kms" } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources).toHaveLength(2);
    expect(resources[0].resourceType).toBe("aws:kms:Key");
    expect(resources[1].resourceType).toBe("aws:kms:Alias");
  });

  it("uses correct naming convention", () => {
    const node = makeNode({
      id: "platform:encryption-key",
      type: "platform",
      metadata: { properties: { platform: "aws-kms" } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].name).toBe("encryption-key-key");
    expect(resources[1].name).toBe("encryption-key-key-alias");
    expect(resources[1].properties["name"]).toBe(
      "alias/my-service-encryption-key",
    );
  });

  it("sets correct tags on key", () => {
    const node = makeNode({
      id: "platform:encryption-key",
      type: "platform",
      metadata: { properties: { platform: "aws-kms" } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = resources[0].properties["tags"] as Record<string, string>;
    expect(tags["shinobi:node"]).toBe("platform:encryption-key");
    expect(tags["shinobi:platform"]).toBe("aws-kms");
  });

  it("defaults to SYMMETRIC_DEFAULT with rotation enabled", () => {
    const node = makeNode({
      id: "platform:encryption-key",
      type: "platform",
      metadata: { properties: { platform: "aws-kms" } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].properties["customerMasterKeySpec"]).toBe(
      "SYMMETRIC_DEFAULT",
    );
    expect(resources[0].properties["enableKeyRotation"]).toBe(true);
  });

  it("disables rotation for asymmetric keys", () => {
    const node = makeNode({
      id: "platform:signing-key",
      type: "platform",
      metadata: { properties: { platform: "aws-kms", keySpec: "RSA_2048" } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].properties["customerMasterKeySpec"]).toBe("RSA_2048");
    expect(resources[0].properties["enableKeyRotation"]).toBe(false);
  });

  it("respects explicit enableKeyRotation=false", () => {
    const node = makeNode({
      id: "platform:no-rotation-key",
      type: "platform",
      metadata: {
        properties: { platform: "aws-kms", enableKeyRotation: false },
      },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].properties["enableKeyRotation"]).toBe(false);
  });

  it("uses custom deletion window", () => {
    const node = makeNode({
      id: "platform:encryption-key",
      type: "platform",
      metadata: {
        properties: { platform: "aws-kms", deletionWindowInDays: 7 },
      },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].properties["deletionWindowInDays"]).toBe(7);
  });

  it("defaults deletion window to 30 days", () => {
    const node = makeNode({
      id: "platform:encryption-key",
      type: "platform",
      metadata: { properties: { platform: "aws-kms" } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].properties["deletionWindowInDays"]).toBe(30);
  });

  it("alias depends on key", () => {
    const node = makeNode({
      id: "platform:encryption-key",
      type: "platform",
      metadata: { properties: { platform: "aws-kms" } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[1].dependsOn).toContain("encryption-key-key");
    expect(resources[1].properties["targetKeyId"]).toEqual({
      ref: "encryption-key-key",
    });
  });

  it("sets sourceId to node ID", () => {
    const node = makeNode({
      id: "platform:encryption-key",
      type: "platform",
      metadata: { properties: { platform: "aws-kms" } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    for (const r of resources) {
      expect(r.sourceId).toBe("platform:encryption-key");
    }
  });

  it("output is deterministic", () => {
    const node = makeNode({
      id: "platform:encryption-key",
      type: "platform",
      metadata: { properties: { platform: "aws-kms" } },
    });

    const r1 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const r2 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it("passes custom tags", () => {
    const node = makeNode({
      id: "platform:encryption-key",
      type: "platform",
      metadata: { properties: { platform: "aws-kms", tags: { env: "prod" } } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = resources[0].properties["tags"] as Record<string, string>;
    expect(tags["env"]).toBe("prod");
  });
});
