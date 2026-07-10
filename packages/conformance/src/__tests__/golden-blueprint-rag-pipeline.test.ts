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
 * Golden test for Blueprint BP-A06: RAG Pipeline
 *
 * Architecture:
 *   S3 → Lambda(ingestion) → Bedrock(embeddings) + OpenSearch(vector store)
 *   Lambda(query-handler) → OpenSearch + DynamoDB
 *   API Gateway → Lambda(query-handler)
 *
 * Mixed blueprint: component nodes (lambdas) + platform nodes
 * Component→platform bindsTo edges produce intents.
 *
 * Gates: determinism (G-001), compilation (G-002), intent generation, policy evaluation
 */

function setupBlueprint(): ReadonlyArray<GraphMutation> {
  const api = createTestNode({
    id: "platform:api",
    type: "platform",
    metadata: { properties: { platform: "aws-apigateway" } },
  });

  const docStore = createTestNode({
    id: "platform:doc-store",
    type: "platform",
    metadata: { properties: { platform: "aws-s3", versioning: true } },
  });

  const ingestion = createTestNode({
    id: "component:ingestion",
    type: "component",
    metadata: {
      properties: {
        platform: "aws-lambda",
        runtime: "nodejs20.x",
        handler: "ingestion.handler",
        memorySize: 512,
        timeout: 300,
        tracing: true,
      },
    },
  });

  const embeddings = createTestNode({
    id: "platform:embeddings",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-bedrock",
        modelId: "amazon.titan-embed-text-v1",
        guardrailEnabled: true,
      },
    },
  });

  const vectorStore = createTestNode({
    id: "platform:vector-store",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-opensearch",
        engineVersion: "OpenSearch_2.11",
        instanceType: "r6g.large.search",
        instanceCount: 2,
        ebsEnabled: true,
        volumeSize: 100,
        encryptionAtRest: true,
        nodeToNodeEncryption: true,
        enforceHTTPS: true,
        publicAccess: false,
      },
    },
  });

  const queryHandler = createTestNode({
    id: "component:query-handler",
    type: "component",
    metadata: {
      properties: {
        platform: "aws-lambda",
        runtime: "nodejs20.x",
        handler: "query.handler",
        memorySize: 512,
        timeout: 60,
        tracing: true,
      },
    },
  });

  const contextStore = createTestNode({
    id: "platform:context-store",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-dynamodb",
        hashKey: "sessionId",
        rangeKey: "timestamp",
      },
    },
  });

  const ingestionToDocStore = createTestEdge({
    id: "edge:bindsTo:component:ingestion:platform:doc-store",
    type: "bindsTo",
    source: ingestion.id,
    target: docStore.id,
    metadata: {
      bindingConfig: {
        resourceType: "bucket",
        accessLevel: "read",
        network: { port: 443, protocol: "tcp" },
        configKeys: [
          {
            key: "DOC_BUCKET",
            valueSource: {
              type: "reference",
              nodeRef: "doc-store",
              field: "bucket",
            },
          },
        ],
      },
    },
  });

  const ingestionToEmbeddings = createTestEdge({
    id: "edge:bindsTo:component:ingestion:platform:embeddings",
    type: "bindsTo",
    source: ingestion.id,
    target: embeddings.id,
    metadata: {
      bindingConfig: {
        resourceType: "bedrock",
        accessLevel: "write",
        network: { port: 443, protocol: "tcp" },
        configKeys: [
          {
            key: "EMBEDDING_MODEL",
            valueSource: {
              type: "static",
              value: "amazon.titan-embed-text-v1",
            },
          },
        ],
      },
    },
  });

  const ingestionToVectorStore = createTestEdge({
    id: "edge:bindsTo:component:ingestion:platform:vector-store",
    type: "bindsTo",
    source: ingestion.id,
    target: vectorStore.id,
    metadata: {
      bindingConfig: {
        resourceType: "domain",
        accessLevel: "write",
        network: { port: 443, protocol: "tcp" },
        configKeys: [
          {
            key: "OPENSEARCH_ENDPOINT",
            valueSource: {
              type: "reference",
              nodeRef: "vector-store",
              field: "endpoint",
            },
          },
        ],
      },
    },
  });

  const queryToVectorStore = createTestEdge({
    id: "edge:bindsTo:component:query-handler:platform:vector-store",
    type: "bindsTo",
    source: queryHandler.id,
    target: vectorStore.id,
    metadata: {
      bindingConfig: {
        resourceType: "domain",
        accessLevel: "read",
        network: { port: 443, protocol: "tcp" },
        configKeys: [
          {
            key: "OPENSEARCH_ENDPOINT",
            valueSource: {
              type: "reference",
              nodeRef: "vector-store",
              field: "endpoint",
            },
          },
        ],
      },
    },
  });

  const queryToContextStore = createTestEdge({
    id: "edge:bindsTo:component:query-handler:platform:context-store",
    type: "bindsTo",
    source: queryHandler.id,
    target: contextStore.id,
    metadata: {
      bindingConfig: {
        resourceType: "table",
        accessLevel: "write",
        network: { port: 443, protocol: "tcp" },
        configKeys: [
          {
            key: "CONTEXT_TABLE",
            valueSource: {
              type: "reference",
              nodeRef: "context-store",
              field: "name",
            },
          },
        ],
      },
    },
  });

  const apiToQueryHandler = createTestEdge({
    id: "edge:triggers:platform:api:component:query-handler",
    type: "triggers",
    source: api.id,
    target: queryHandler.id,
    metadata: {
      bindingConfig: {
        route: "/query",
        method: "POST",
      },
    },
  });

  return [
    { type: "addNode", node: api },
    { type: "addNode", node: docStore },
    { type: "addNode", node: ingestion },
    { type: "addNode", node: embeddings },
    { type: "addNode", node: vectorStore },
    { type: "addNode", node: queryHandler },
    { type: "addNode", node: contextStore },
    { type: "addEdge", edge: ingestionToDocStore },
    { type: "addEdge", edge: ingestionToEmbeddings },
    { type: "addEdge", edge: ingestionToVectorStore },
    { type: "addEdge", edge: queryToVectorStore },
    { type: "addEdge", edge: queryToContextStore },
    { type: "addEdge", edge: apiToQueryHandler },
  ];
}

function makeBinders() {
  const registry = new BinderRegistry();
  registry.register(new ComponentPlatformBinder());
  registry.register(new TriggersBinder());
  return registry.getBinders();
}

describe("Golden: Blueprint BP-A06 — RAG Pipeline", () => {
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

  it("contains all 7 nodes", () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: "Baseline" },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    expect(compilation.snapshot.nodes).toHaveLength(7);
    const ids = compilation.snapshot.nodes.map((n) => n.id);
    expect(ids).toContain("platform:api");
    expect(ids).toContain("platform:doc-store");
    expect(ids).toContain("component:ingestion");
    expect(ids).toContain("platform:embeddings");
    expect(ids).toContain("platform:vector-store");
    expect(ids).toContain("component:query-handler");
    expect(ids).toContain("platform:context-store");
  });

  it("contains 6 edges", () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: "Baseline" },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    expect(compilation.snapshot.edges).toHaveLength(6);
  });

  it("emits intents (component→platform edges)", () => {
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

    it("has violations from iam-missing-conditions (cross-service, no conditions)", () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: "Baseline" },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const condViolations = compilation.policy?.violations.filter(
        (v) => v.ruleId === "iam-missing-conditions",
      );
      expect(condViolations?.length).toBeGreaterThan(0);
    });

    it("opensearch-encryption-disabled does not fire (encryption enabled)", () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: "Baseline" },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const violations = compilation.policy?.violations.filter(
        (v) => v.ruleId === "opensearch-encryption-disabled",
      );
      expect(violations).toHaveLength(0);
    });
  });
});
