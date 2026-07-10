import { describe, it, expect } from "vitest";
import { createTestNode, createTestEdge } from "@shinobi/ir";
import type { GraphMutation } from "@shinobi/ir";
import {
  ComponentPlatformBinder,
  TriggersBinder,
  BinderRegistry,
} from "@shinobi/binder";
import { BaselinePolicyEvaluator } from "@shinobi/policy";
import { runGoldenCase } from "../golden-runner";

/**
 * Golden test for Blueprint BP-005: EKS Managed Cluster
 *
 * Architecture:
 *   VPC + 2 Subnets + Security Group
 *   EKS Cluster (private endpoint, logging enabled)
 *   EKS Managed Node Group (t3.medium, 2 desired)
 *
 * This is a platform-only blueprint — all nodes are platform type.
 * Platform-to-platform bindsTo edges produce zero intents because
 * ComponentPlatformBinder only fires for component→platform edges.
 *
 * Gates: determinism (G-001), compilation (G-002), policy evaluation
 */

function setupBlueprint(): ReadonlyArray<GraphMutation> {
  const appVpc = createTestNode({
    id: "platform:app-vpc",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-vpc",
        cidrBlock: "10.0.0.0/16",
      },
    },
  });

  const subnet1a = createTestNode({
    id: "platform:subnet-1a",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-subnet",
        vpcId: "platform:app-vpc",
        cidrBlock: "10.0.1.0/24",
        availabilityZone: "us-east-1a",
        mapPublicIpOnLaunch: false,
      },
    },
  });

  const subnet1b = createTestNode({
    id: "platform:subnet-1b",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-subnet",
        vpcId: "platform:app-vpc",
        cidrBlock: "10.0.2.0/24",
        availabilityZone: "us-east-1b",
        mapPublicIpOnLaunch: false,
      },
    },
  });

  const clusterSg = createTestNode({
    id: "platform:cluster-sg",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-security-group",
        vpcId: "platform:app-vpc",
        description: "EKS cluster security group",
      },
    },
  });

  const eksCluster = createTestNode({
    id: "platform:eks-cluster",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-eks-cluster",
        version: "1.29",
        subnetIds: ["platform:subnet-1a", "platform:subnet-1b"],
        securityGroupIds: ["platform:cluster-sg"],
        endpointPrivateAccess: true,
        endpointPublicAccess: false,
        enabledClusterLogTypes: ["api", "audit", "authenticator"],
      },
    },
  });

  const eksNodes = createTestNode({
    id: "platform:eks-nodes",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-eks-node-group",
        clusterName: "platform:eks-cluster",
        subnetIds: ["platform:subnet-1a", "platform:subnet-1b"],
        instanceTypes: ["t3.medium"],
        scalingConfig: { desiredSize: 2, minSize: 1, maxSize: 4 },
        amiType: "AL2_x86_64",
        diskSize: 20,
      },
    },
  });

  const nodesBindsCluster = createTestEdge({
    id: "edge:bindsTo:platform:eks-nodes:platform:eks-cluster",
    type: "bindsTo",
    source: eksNodes.id,
    target: eksCluster.id,
    metadata: {
      bindingConfig: {
        resourceType: "cluster",
        accessLevel: "read",
      },
    },
  });

  return [
    { type: "addNode", node: appVpc },
    { type: "addNode", node: subnet1a },
    { type: "addNode", node: subnet1b },
    { type: "addNode", node: clusterSg },
    { type: "addNode", node: eksCluster },
    { type: "addNode", node: eksNodes },
    { type: "addEdge", edge: nodesBindsCluster },
  ];
}

function makeBinders() {
  const registry = new BinderRegistry();
  registry.register(new ComponentPlatformBinder());
  registry.register(new TriggersBinder());
  return registry.getBinders();
}

describe("Golden: Blueprint BP-005 — EKS Managed Cluster", () => {
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

  it("contains all 6 nodes", () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: "Baseline" },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    expect(compilation.snapshot.nodes).toHaveLength(6);
    const ids = compilation.snapshot.nodes.map((n) => n.id);
    expect(ids).toContain("platform:app-vpc");
    expect(ids).toContain("platform:subnet-1a");
    expect(ids).toContain("platform:subnet-1b");
    expect(ids).toContain("platform:cluster-sg");
    expect(ids).toContain("platform:eks-cluster");
    expect(ids).toContain("platform:eks-nodes");
  });

  it("contains 1 edge (nodes→cluster)", () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: "Baseline" },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    expect(compilation.snapshot.edges).toHaveLength(1);
  });

  it("emits zero intents (platform-to-platform edges do not produce intents)", () => {
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

    it("eks-endpoint-public-access does not fire (private endpoint)", () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: "Baseline" },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const violations = compilation.policy?.violations.filter(
        (v) => v.ruleId === "eks-endpoint-public-access",
      );
      expect(violations).toHaveLength(0);
    });

    it("eks-logging-disabled does not fire (logging enabled)", () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: "Baseline" },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const violations = compilation.policy?.violations.filter(
        (v) => v.ruleId === "eks-logging-disabled",
      );
      expect(violations).toHaveLength(0);
    });

    it("FedRAMP-High escalates eks-endpoint-public-access to error", () => {
      // Build a variant with public endpoint to test severity escalation
      const publicCluster = createTestNode({
        id: "platform:public-cluster",
        type: "platform",
        metadata: {
          properties: {
            platform: "aws-eks-cluster",
            endpointPublicAccess: true,
            enabledClusterLogTypes: ["api", "audit", "authenticator"],
          },
        },
      });

      const mutations: ReadonlyArray<GraphMutation> = [
        { type: "addNode", node: publicCluster },
      ];

      const { compilation } = runGoldenCase({
        setup: () => mutations,
        config: { policyPack: "FedRAMP-High" },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const violations = compilation.policy?.violations.filter(
        (v) => v.ruleId === "eks-endpoint-public-access",
      );
      expect(violations?.length).toBeGreaterThanOrEqual(1);
      for (const v of violations ?? []) {
        expect(v.severity).toBe("error");
      }
    });
  });
});
