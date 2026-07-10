import { describe, it, expect } from "vitest";
import { SecretsManagerLowerer } from "../lowerers/secretsmanager-lowerer";
import { makeNode, makeDefaultContext, makeDefaultDeps } from "./test-helpers";

const DEFAULT_CONTEXT = makeDefaultContext({
  adapterConfig: { region: "us-east-1", serviceName: "my-service" },
});
const DEFAULT_DEPS = makeDefaultDeps();

describe("SecretsManagerLowerer", () => {
  const lowerer = new SecretsManagerLowerer();

  it("has correct platform", () => {
    expect(lowerer.platform).toBe("aws-secretsmanager");
  });

  it("produces Secret resource", () => {
    const node = makeNode({
      id: "platform:app-secret",
      type: "platform",
      metadata: { properties: { platform: "aws-secretsmanager" } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources).toHaveLength(1);
    expect(resources[0].resourceType).toBe("aws:secretsmanager:Secret");
  });

  it("uses correct naming convention", () => {
    const node = makeNode({
      id: "platform:db-creds",
      type: "platform",
      metadata: { properties: { platform: "aws-secretsmanager" } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].name).toBe("db-creds-secret");
    expect(resources[0].properties["name"]).toBe("my-service-db-creds");
  });

  it("sets correct tags", () => {
    const node = makeNode({
      id: "platform:app-secret",
      type: "platform",
      metadata: { properties: { platform: "aws-secretsmanager" } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = resources[0].properties["tags"] as Record<string, string>;
    expect(tags["shinobi:node"]).toBe("platform:app-secret");
    expect(tags["shinobi:platform"]).toBe("aws-secretsmanager");
  });

  it("adds KMS key reference when kmsKeyId is provided", () => {
    const node = makeNode({
      id: "platform:app-secret",
      type: "platform",
      metadata: {
        properties: {
          platform: "aws-secretsmanager",
          kmsKeyId: "platform:encryption-key",
        },
      },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].properties["kmsKeyId"]).toEqual({
      ref: "encryption-key-key",
    });
    expect(resources[0].dependsOn).toContain("encryption-key-key");
  });

  it("produces rotation schedule when rotationEnabled is true", () => {
    const node = makeNode({
      id: "platform:rotating-secret",
      type: "platform",
      metadata: {
        properties: { platform: "aws-secretsmanager", rotationEnabled: true },
      },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources).toHaveLength(2);
    expect(resources[1].resourceType).toBe("aws:secretsmanager:SecretRotation");
    expect(resources[1].name).toBe("rotating-secret-secret-rotation");
    expect(resources[1].dependsOn).toContain("rotating-secret-secret");
  });

  it("uses custom rotation days", () => {
    const node = makeNode({
      id: "platform:rotating-secret",
      type: "platform",
      metadata: {
        properties: {
          platform: "aws-secretsmanager",
          rotationEnabled: true,
          rotationDays: 7,
        },
      },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const rotation = resources[1];
    const rules = rotation.properties["rotationRules"] as Record<
      string,
      unknown
    >;
    expect(rules["automaticallyAfterDays"]).toBe(7);
  });

  it("defaults rotation to 30 days", () => {
    const node = makeNode({
      id: "platform:rotating-secret",
      type: "platform",
      metadata: {
        properties: { platform: "aws-secretsmanager", rotationEnabled: true },
      },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const rotation = resources[1];
    const rules = rotation.properties["rotationRules"] as Record<
      string,
      unknown
    >;
    expect(rules["automaticallyAfterDays"]).toBe(30);
  });

  it("does not produce rotation when rotationEnabled is not set", () => {
    const node = makeNode({
      id: "platform:static-secret",
      type: "platform",
      metadata: { properties: { platform: "aws-secretsmanager" } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources).toHaveLength(1);
  });

  it("has no dependencies when no KMS key", () => {
    const node = makeNode({
      id: "platform:app-secret",
      type: "platform",
      metadata: { properties: { platform: "aws-secretsmanager" } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].dependsOn).toEqual([]);
  });

  it("sets sourceId to node ID", () => {
    const node = makeNode({
      id: "platform:app-secret",
      type: "platform",
      metadata: { properties: { platform: "aws-secretsmanager" } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].sourceId).toBe("platform:app-secret");
  });

  it("output is deterministic", () => {
    const node = makeNode({
      id: "platform:app-secret",
      type: "platform",
      metadata: {
        properties: { platform: "aws-secretsmanager", rotationEnabled: true },
      },
    });

    const r1 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const r2 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it("passes custom tags", () => {
    const node = makeNode({
      id: "platform:app-secret",
      type: "platform",
      metadata: {
        properties: { platform: "aws-secretsmanager", tags: { env: "prod" } },
      },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = resources[0].properties["tags"] as Record<string, string>;
    expect(tags["env"]).toBe("prod");
  });
});
