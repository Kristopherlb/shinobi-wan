import { describe, it, expect } from "vitest";
import { createTestNode } from "@shinobi/ir";
import type { GraphMutation } from "@shinobi/ir";
import {
  ComponentPlatformBinder,
  TriggersBinder,
  BinderRegistry,
} from "@shinobi/binder";
import { BaselinePolicyEvaluator } from "@shinobi/policy";
import { runGoldenCase } from "../golden-runner";

/**
 * Golden test for Blueprint BP-I03: Networking Hub-Spoke
 *
 * Architecture:
 *   Hub VPC (public + private subnets, SG)
 *   Spoke A VPC + Subnet
 *   Spoke B VPC + Subnet
 *   Transit Gateway + 3 TGW VPC Attachments
 *   Network Firewall + NAT Gateway
 *
 * Pure topology blueprint — 14 nodes, 0 edges.
 *
 * Gates: determinism (G-001), compilation (G-002), policy evaluation
 */

function setupBlueprint(): ReadonlyArray<GraphMutation> {
  const hubVpc = createTestNode({
    id: "platform:hub-vpc",
    type: "platform",
    metadata: { properties: { platform: "aws-vpc", cidrBlock: "10.0.0.0/16" } },
  });
  const hubPublicSubnet = createTestNode({
    id: "platform:hub-public-subnet",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-subnet",
        vpcId: "platform:hub-vpc",
        cidrBlock: "10.0.1.0/24",
        availabilityZone: "us-east-1a",
        mapPublicIpOnLaunch: true,
      },
    },
  });
  const hubPrivateSubnet = createTestNode({
    id: "platform:hub-private-subnet",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-subnet",
        vpcId: "platform:hub-vpc",
        cidrBlock: "10.0.2.0/24",
        availabilityZone: "us-east-1a",
        mapPublicIpOnLaunch: false,
      },
    },
  });
  const hubSg = createTestNode({
    id: "platform:hub-sg",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-security-group",
        vpcId: "platform:hub-vpc",
        description: "Hub SG",
      },
    },
  });
  const spokeAVpc = createTestNode({
    id: "platform:spoke-a-vpc",
    type: "platform",
    metadata: { properties: { platform: "aws-vpc", cidrBlock: "10.1.0.0/16" } },
  });
  const spokeASubnet = createTestNode({
    id: "platform:spoke-a-subnet",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-subnet",
        vpcId: "platform:spoke-a-vpc",
        cidrBlock: "10.1.1.0/24",
        availabilityZone: "us-east-1a",
        mapPublicIpOnLaunch: false,
      },
    },
  });
  const spokeBVpc = createTestNode({
    id: "platform:spoke-b-vpc",
    type: "platform",
    metadata: { properties: { platform: "aws-vpc", cidrBlock: "10.2.0.0/16" } },
  });
  const spokeBSubnet = createTestNode({
    id: "platform:spoke-b-subnet",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-subnet",
        vpcId: "platform:spoke-b-vpc",
        cidrBlock: "10.2.1.0/24",
        availabilityZone: "us-east-1a",
        mapPublicIpOnLaunch: false,
      },
    },
  });
  const transitGw = createTestNode({
    id: "platform:transit-gw",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-transit-gateway",
        autoAcceptSharedAttachments: "disable",
        dnsSupport: "enable",
      },
    },
  });
  const hubTgwAttach = createTestNode({
    id: "platform:hub-tgw-attach",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-tgw-vpc-attachment",
        transitGatewayRef: "platform:transit-gw",
        vpcRef: "platform:hub-vpc",
        subnetIds: ["platform:hub-private-subnet"],
      },
    },
  });
  const spokeATgwAttach = createTestNode({
    id: "platform:spoke-a-tgw-attach",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-tgw-vpc-attachment",
        transitGatewayRef: "platform:transit-gw",
        vpcRef: "platform:spoke-a-vpc",
        subnetIds: ["platform:spoke-a-subnet"],
      },
    },
  });
  const spokeBTgwAttach = createTestNode({
    id: "platform:spoke-b-tgw-attach",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-tgw-vpc-attachment",
        transitGatewayRef: "platform:transit-gw",
        vpcRef: "platform:spoke-b-vpc",
        subnetIds: ["platform:spoke-b-subnet"],
      },
    },
  });
  const networkFw = createTestNode({
    id: "platform:network-fw",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-network-firewall",
        vpcRef: "platform:hub-vpc",
        subnetMappings: ["platform:hub-private-subnet"],
        loggingEnabled: true,
        deleteProtection: true,
      },
    },
  });
  const natGw = createTestNode({
    id: "platform:nat-gw",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-nat-gateway",
        subnetRef: "platform:hub-public-subnet",
        connectivityType: "public",
      },
    },
  });

  return [
    { type: "addNode", node: hubVpc },
    { type: "addNode", node: hubPublicSubnet },
    { type: "addNode", node: hubPrivateSubnet },
    { type: "addNode", node: hubSg },
    { type: "addNode", node: spokeAVpc },
    { type: "addNode", node: spokeASubnet },
    { type: "addNode", node: spokeBVpc },
    { type: "addNode", node: spokeBSubnet },
    { type: "addNode", node: transitGw },
    { type: "addNode", node: hubTgwAttach },
    { type: "addNode", node: spokeATgwAttach },
    { type: "addNode", node: spokeBTgwAttach },
    { type: "addNode", node: networkFw },
    { type: "addNode", node: natGw },
  ];
}

function makeBinders() {
  const registry = new BinderRegistry();
  registry.register(new ComponentPlatformBinder());
  registry.register(new TriggersBinder());
  return registry.getBinders();
}

describe("Golden: Blueprint BP-I03 — Networking Hub-Spoke", () => {
  const evaluator = new BaselinePolicyEvaluator();

  it("compiles successfully", () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: "Baseline" },
      binders: makeBinders(),
      evaluators: [evaluator],
    });
    expect(compilation.validation.valid).toBe(true);
  });

  it("contains all 14 nodes", () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: "Baseline" },
      binders: makeBinders(),
      evaluators: [evaluator],
    });
    expect(compilation.snapshot.nodes).toHaveLength(14);
  });

  it("contains 0 edges (pure topology)", () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: "Baseline" },
      binders: makeBinders(),
      evaluators: [evaluator],
    });
    expect(compilation.snapshot.edges).toHaveLength(0);
  });

  it("emits zero intents", () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: "Baseline" },
      binders: makeBinders(),
      evaluators: [evaluator],
    });
    expect(compilation.intents).toHaveLength(0);
  });

  it("determinism: identical output across two runs", () => {
    const opts = {
      setup: setupBlueprint,
      config: { policyPack: "Baseline" },
      binders: makeBinders(),
      evaluators: [evaluator],
    };
    const r1 = runGoldenCase(opts);
    const r2 = runGoldenCase(opts);
    expect(r1.serialized).toBe(r2.serialized);
  });

  describe("policy evaluation across packs", () => {
    it.each(["Baseline", "FedRAMP-Moderate", "FedRAMP-High"] as const)(
      "evaluates with pack %s without throwing",
      (pack) => {
        const { compilation } = runGoldenCase({
          setup: setupBlueprint,
          config: { policyPack: pack },
          binders: makeBinders(),
          evaluators: [evaluator],
        });
        expect(compilation.policy?.violations).toBeDefined();
      },
    );

    it("transit-gateway-auto-accept-enabled does not fire (disabled)", () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: "Baseline" },
        binders: makeBinders(),
        evaluators: [evaluator],
      });
      expect(
        compilation.policy?.violations.filter(
          (v) => v.ruleId === "transit-gateway-auto-accept-enabled",
        ),
      ).toHaveLength(0);
    });

    it("network-firewall-logging-disabled does not fire (logging enabled)", () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: "Baseline" },
        binders: makeBinders(),
        evaluators: [evaluator],
      });
      expect(
        compilation.policy?.violations.filter(
          (v) => v.ruleId === "network-firewall-logging-disabled",
        ),
      ).toHaveLength(0);
    });
  });
});
