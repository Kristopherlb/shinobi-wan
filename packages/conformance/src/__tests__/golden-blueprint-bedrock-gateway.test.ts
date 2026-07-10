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
 * Golden test for Blueprint BP-A01: Bedrock Gateway + Cost Controls
 *
 * Architecture:
 *   API Gateway → Lambda → Bedrock
 *   Lambda → DynamoDB (cost tracking)
 *   Lambda → S3 (logs)
 *
 * Mixed blueprint: triggers + bindsTo edges produce intents.
 *
 * Gates: determinism (G-001), compilation (G-002), policy evaluation
 */

function setupBlueprint(): ReadonlyArray<GraphMutation> {
  const api = createTestNode({
    id: "platform:api",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-apigateway",
      },
    },
  });

  const gatewayHandler = createTestNode({
    id: "component:gateway-handler",
    type: "component",
    metadata: {
      properties: {
        platform: "aws-lambda",
        runtime: "nodejs20.x",
        handler: "gateway.handler",
        memorySize: 512,
        timeout: 120,
        tracing: true,
        powertools: true,
      },
    },
  });

  const llm = createTestNode({
    id: "platform:llm",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-bedrock",
        modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
        guardrailEnabled: true,
        invocationLogging: true,
      },
    },
  });

  const costTracker = createTestNode({
    id: "platform:cost-tracker",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-dynamodb",
        hashKey: "apiKey",
        rangeKey: "timestamp",
      },
    },
  });

  const invocationLogs = createTestNode({
    id: "platform:invocation-logs",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-s3",
        versioning: true,
      },
    },
  });

  const apiToLambda = createTestEdge({
    id: "edge:triggers:platform:api:component:gateway-handler",
    type: "triggers",
    source: api.id,
    target: gatewayHandler.id,
    metadata: {
      bindingConfig: {
        route: "/invoke",
        method: "POST",
      },
    },
  });

  const lambdaToBedrock = createTestEdge({
    id: "edge:bindsTo:component:gateway-handler:platform:llm",
    type: "bindsTo",
    source: gatewayHandler.id,
    target: llm.id,
    metadata: {
      bindingConfig: {
        resourceType: "bedrock",
        accessLevel: "write",
        network: { port: 443, protocol: "tcp" },
        configKeys: [
          {
            key: "MODEL_ID",
            valueSource: {
              type: "static",
              value: "anthropic.claude-3-sonnet-20240229-v1:0",
            },
          },
        ],
      },
    },
  });

  const lambdaToDynamo = createTestEdge({
    id: "edge:bindsTo:component:gateway-handler:platform:cost-tracker",
    type: "bindsTo",
    source: gatewayHandler.id,
    target: costTracker.id,
    metadata: {
      bindingConfig: {
        resourceType: "table",
        accessLevel: "write",
        network: { port: 443, protocol: "tcp" },
        configKeys: [
          {
            key: "COST_TABLE",
            valueSource: {
              type: "reference",
              nodeRef: "cost-tracker",
              field: "name",
            },
          },
        ],
      },
    },
  });

  const lambdaToS3 = createTestEdge({
    id: "edge:bindsTo:component:gateway-handler:platform:invocation-logs",
    type: "bindsTo",
    source: gatewayHandler.id,
    target: invocationLogs.id,
    metadata: {
      bindingConfig: {
        resourceType: "bucket",
        accessLevel: "write",
        network: { port: 443, protocol: "tcp" },
        configKeys: [
          {
            key: "LOGS_BUCKET",
            valueSource: {
              type: "reference",
              nodeRef: "invocation-logs",
              field: "bucket",
            },
          },
        ],
      },
    },
  });

  return [
    { type: "addNode", node: api },
    { type: "addNode", node: gatewayHandler },
    { type: "addNode", node: llm },
    { type: "addNode", node: costTracker },
    { type: "addNode", node: invocationLogs },
    { type: "addEdge", edge: apiToLambda },
    { type: "addEdge", edge: lambdaToBedrock },
    { type: "addEdge", edge: lambdaToDynamo },
    { type: "addEdge", edge: lambdaToS3 },
  ];
}

function makeBinders() {
  const registry = new BinderRegistry();
  registry.register(new ComponentPlatformBinder());
  registry.register(new TriggersBinder());
  return registry.getBinders();
}

describe("Golden: Blueprint BP-A01 — Bedrock Gateway", () => {
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

  it("contains all 5 nodes", () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: "Baseline" },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    expect(compilation.snapshot.nodes).toHaveLength(5);
    const ids = compilation.snapshot.nodes.map((n) => n.id);
    expect(ids).toContain("platform:api");
    expect(ids).toContain("component:gateway-handler");
    expect(ids).toContain("platform:llm");
    expect(ids).toContain("platform:cost-tracker");
    expect(ids).toContain("platform:invocation-logs");
  });

  it("contains 4 edges", () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: "Baseline" },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    expect(compilation.snapshot.edges).toHaveLength(4);
  });

  it("emits intents (component→platform + triggers edges)", () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: "Baseline" },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    expect(compilation.intents.length).toBeGreaterThan(0);
    const types = [...new Set(compilation.intents.map((i) => i.type))];
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

    it("bedrock-guardrails-disabled does not fire (guardrails enabled)", () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: "Baseline" },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const violations = compilation.policy?.violations.filter(
        (v) => v.ruleId === "bedrock-guardrails-disabled",
      );
      expect(violations).toHaveLength(0);
    });
  });
});
