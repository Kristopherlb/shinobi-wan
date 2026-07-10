import { describe, it, expect } from "vitest";
import { RdsProxyLowerer } from "../lowerers/rds-proxy-lowerer";
import { makeNode, makeDefaultContext, makeDefaultDeps } from "./test-helpers";

const DEFAULT_CONTEXT = makeDefaultContext({
  adapterConfig: { region: "us-east-1", serviceName: "my-service" },
});
const DEFAULT_DEPS = makeDefaultDeps();

describe("RdsProxyLowerer", () => {
  const lowerer = new RdsProxyLowerer();

  it("has correct platform", () => {
    expect(lowerer.platform).toBe("aws-rds-proxy");
  });

  it("produces Proxy + TargetGroup + Target resources", () => {
    const node = makeNode({
      id: "platform:db-proxy",
      type: "platform",
      metadata: { properties: { platform: "aws-rds-proxy" } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources).toHaveLength(3);
    expect(resources[0].resourceType).toBe("aws:rds:Proxy");
    expect(resources[1].resourceType).toBe("aws:rds:ProxyDefaultTargetGroup");
    expect(resources[2].resourceType).toBe("aws:rds:ProxyTarget");
  });

  it("uses correct naming convention", () => {
    const node = makeNode({
      id: "platform:db-proxy",
      type: "platform",
      metadata: { properties: { platform: "aws-rds-proxy" } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].name).toBe("db-proxy-rds-proxy");
    expect(resources[1].name).toBe("db-proxy-rds-proxy-target-group");
    expect(resources[2].name).toBe("db-proxy-rds-proxy-target");
  });

  it("sets correct tags", () => {
    const node = makeNode({
      id: "platform:db-proxy",
      type: "platform",
      metadata: { properties: { platform: "aws-rds-proxy" } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = resources[0].properties["tags"] as Record<string, string>;
    expect(tags["shinobi:node"]).toBe("platform:db-proxy");
    expect(tags["shinobi:platform"]).toBe("aws-rds-proxy");
  });

  it("applies default config values", () => {
    const node = makeNode({
      id: "platform:db-proxy",
      type: "platform",
      metadata: { properties: { platform: "aws-rds-proxy" } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const proxy = resources[0].properties;
    expect(proxy["engineFamily"]).toBe("POSTGRESQL");
    expect(proxy["requireTls"]).toBe(true);
    expect(proxy["idleClientTimeout"]).toBe(1800);
    expect(proxy["debugLogging"]).toBe(false);
  });

  it("target group depends on proxy", () => {
    const node = makeNode({
      id: "platform:db-proxy",
      type: "platform",
      metadata: { properties: { platform: "aws-rds-proxy" } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[1].dependsOn).toContain("db-proxy-rds-proxy");
    expect(resources[1].properties["dbProxyName"]).toEqual({
      ref: "db-proxy-rds-proxy",
    });
  });

  it("target depends on proxy and target group", () => {
    const node = makeNode({
      id: "platform:db-proxy",
      type: "platform",
      metadata: { properties: { platform: "aws-rds-proxy" } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[2].dependsOn).toContain("db-proxy-rds-proxy");
    expect(resources[2].dependsOn).toContain("db-proxy-rds-proxy-target-group");
  });

  it("passes cluster ref when provided", () => {
    const node = makeNode({
      id: "platform:db-proxy",
      type: "platform",
      metadata: {
        properties: {
          platform: "aws-rds-proxy",
          clusterRef: { ref: "db-cluster-rds-cluster" },
        },
      },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[2].properties["dbClusterIdentifier"]).toEqual({
      ref: "db-cluster-rds-cluster",
    });
  });

  it("configures auth with secret ARN", () => {
    const node = makeNode({
      id: "platform:db-proxy",
      type: "platform",
      metadata: {
        properties: {
          platform: "aws-rds-proxy",
          secretArn: { ref: "db-secret-secret.arn" },
        },
      },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const auths = resources[0].properties["auths"] as unknown[];
    expect(auths).toHaveLength(1);
  });

  it("sets sourceId to node ID", () => {
    const node = makeNode({
      id: "platform:db-proxy",
      type: "platform",
      metadata: { properties: { platform: "aws-rds-proxy" } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    for (const r of resources) {
      expect(r.sourceId).toBe("platform:db-proxy");
    }
  });

  it("output is deterministic", () => {
    const node = makeNode({
      id: "platform:db-proxy",
      type: "platform",
      metadata: { properties: { platform: "aws-rds-proxy" } },
    });

    const r1 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const r2 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});
