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
 * Golden test for Blueprint BP-A07: Vector Database
 *
 * Architecture:
 *   OpenSearch Serverless Collection (VECTORSEARCH)
 *   Lambda admin handler for index management
 *   KMS encryption key for customer-managed encryption
 *
 * Mixed blueprint: 1 component node (admin-handler) + 2 platform nodes.
 * Component→platform bindsTo edge produces intents.
 *
 * Gates: determinism (G-001), compilation (G-002), intent generation, policy evaluation
 */

function setupBlueprint(): ReadonlyArray<GraphMutation> {
  const encryptionKey = createTestNode({
    id: "platform:encryption-key",
    type: "platform",
    metadata: { properties: { platform: "aws-kms", enableKeyRotation: true } },
  });

  const vectorStore = createTestNode({
    id: "platform:vector-store",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-opensearch-serverless",
        collectionType: "VECTORSEARCH",
        standbyReplicas: "ENABLED",
        encryptionType: "CUSTOMER_MANAGED_KEY",
        kmsKeyArn: "platform:encryption-key",
        publicAccess: false,
      },
    },
  });

  const adminHandler = createTestNode({
    id: "component:admin-handler",
    type: "component",
    metadata: {
      properties: {
        platform: "aws-lambda",
        runtime: "nodejs20.x",
        handler: "admin.handler",
        memorySize: 256,
        timeout: 60,
        tracing: true,
      },
    },
  });

  const adminToVectorStore = createTestEdge({
    id: "edge:bindsTo:component:admin-handler:platform:vector-store",
    type: "bindsTo",
    source: adminHandler.id,
    target: vectorStore.id,
    metadata: {
      bindingConfig: {
        resourceType: "collection",
        accessLevel: "write",
        network: { port: 443, protocol: "tcp" },
        configKeys: [
          {
            key: "COLLECTION_ENDPOINT",
            valueSource: {
              type: "reference",
              nodeRef: "vector-store",
              field: "collectionEndpoint",
            },
          },
        ],
      },
    },
  });

  return [
    { type: "addNode", node: encryptionKey },
    { type: "addNode", node: vectorStore },
    { type: "addNode", node: adminHandler },
    { type: "addEdge", edge: adminToVectorStore },
  ];
}

function makeBinders() {
  const registry = new BinderRegistry();
  registry.register(new ComponentPlatformBinder());
  registry.register(new TriggersBinder());
  return registry.getBinders();
}

describe("Golden: Blueprint BP-A07 — Vector Database", () => {
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

  it("contains all 3 nodes", () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: "Baseline" },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    expect(compilation.snapshot.nodes).toHaveLength(3);
    const ids = compilation.snapshot.nodes.map((n) => n.id);
    expect(ids).toContain("platform:encryption-key");
    expect(ids).toContain("platform:vector-store");
    expect(ids).toContain("component:admin-handler");
  });

  it("contains 1 edge", () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: "Baseline" },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    expect(compilation.snapshot.edges).toHaveLength(1);
  });

  it("emits intents (component→platform edge)", () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: "Baseline" },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    expect(compilation.intents.length).toBeGreaterThan(0);
    const types = compilation.intents.map((i) => i.type);
    expect(types).toContain("iam");
    expect(types).toContain("network");
    expect(types).toContain("config");
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

    it("opensearch-public-access does not fire (publicAccess=false)", () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: "Baseline" },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const violations = compilation.policy?.violations.filter(
        (v) => v.ruleId === "opensearch-public-access",
      );
      expect(violations).toHaveLength(0);
    });
  });
});
