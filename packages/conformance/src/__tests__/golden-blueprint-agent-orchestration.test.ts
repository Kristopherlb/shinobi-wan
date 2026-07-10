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
 * Golden test for Blueprint BP-A09: Agent Orchestration (SFN)
 *
 * Architecture:
 *   API Gateway → Orchestrator Lambda → Step Functions State Machine
 *                                            ├── Agent Worker Lambda → DynamoDB (state)
 *                                            └── Agent Worker Lambda → S3 (artifacts)
 *
 * Zero new lowerers — validates composition of existing primitives.
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

  const orchestrator = createTestNode({
    id: "component:orchestrator",
    type: "component",
    metadata: {
      properties: {
        platform: "aws-lambda",
        runtime: "nodejs20.x",
        handler: "orchestrator.handler",
        memorySize: 256,
        timeout: 30,
        tracing: true,
      },
    },
  });

  const agentWorkflow = createTestNode({
    id: "platform:agent-workflow",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-stepfunctions",
        type: "STANDARD",
        logging: true,
        logLevel: "ALL",
      },
    },
  });

  const agentWorker = createTestNode({
    id: "component:agent-worker",
    type: "component",
    metadata: {
      properties: {
        platform: "aws-lambda",
        runtime: "nodejs20.x",
        handler: "worker.handler",
        memorySize: 512,
        timeout: 60,
        tracing: true,
      },
    },
  });

  const stateStore = createTestNode({
    id: "platform:state-store",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-dynamodb",
        hashKey: "agentId",
        rangeKey: "stepId",
      },
    },
  });

  const artifactStore = createTestNode({
    id: "platform:artifact-store",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-s3",
        versioning: true,
      },
    },
  });

  // Edges
  const apiTriggersOrchestrator = createTestEdge({
    id: "edge:triggers:platform:api:component:orchestrator",
    type: "triggers",
    source: api.id,
    target: orchestrator.id,
    metadata: {
      bindingConfig: {
        route: "/orchestrate",
        method: "POST",
      },
    },
  });

  const orchestratorBindsWorkflow = createTestEdge({
    id: "edge:bindsTo:component:orchestrator:platform:agent-workflow",
    type: "bindsTo",
    source: orchestrator.id,
    target: agentWorkflow.id,
    metadata: {
      bindingConfig: {
        resourceType: "statemachine",
        accessLevel: "write",
        network: { port: 443, protocol: "tcp" },
        configKeys: [
          {
            key: "STATE_MACHINE_ARN",
            valueSource: {
              type: "reference",
              nodeRef: "agent-workflow",
              field: "arn",
            },
          },
        ],
      },
    },
  });

  const orchestratorBindsStateStore = createTestEdge({
    id: "edge:bindsTo:component:orchestrator:platform:state-store",
    type: "bindsTo",
    source: orchestrator.id,
    target: stateStore.id,
    metadata: {
      bindingConfig: {
        resourceType: "table",
        accessLevel: "read",
        network: { port: 443, protocol: "tcp" },
        configKeys: [
          {
            key: "STATE_TABLE_NAME",
            valueSource: {
              type: "reference",
              nodeRef: "state-store",
              field: "table",
            },
          },
        ],
      },
    },
  });

  const workerBindsStateStore = createTestEdge({
    id: "edge:bindsTo:component:agent-worker:platform:state-store",
    type: "bindsTo",
    source: agentWorker.id,
    target: stateStore.id,
    metadata: {
      bindingConfig: {
        resourceType: "table",
        accessLevel: "write",
        network: { port: 443, protocol: "tcp" },
        configKeys: [
          {
            key: "STATE_TABLE_NAME",
            valueSource: {
              type: "reference",
              nodeRef: "state-store",
              field: "table",
            },
          },
        ],
      },
    },
  });

  const workerBindsArtifactStore = createTestEdge({
    id: "edge:bindsTo:component:agent-worker:platform:artifact-store",
    type: "bindsTo",
    source: agentWorker.id,
    target: artifactStore.id,
    metadata: {
      bindingConfig: {
        resourceType: "bucket",
        accessLevel: "write",
        network: { port: 443, protocol: "tcp" },
        configKeys: [
          {
            key: "ARTIFACT_BUCKET",
            valueSource: {
              type: "reference",
              nodeRef: "artifact-store",
              field: "bucket",
            },
          },
        ],
      },
    },
  });

  return [
    { type: "addNode", node: api },
    { type: "addNode", node: orchestrator },
    { type: "addNode", node: agentWorkflow },
    { type: "addNode", node: agentWorker },
    { type: "addNode", node: stateStore },
    { type: "addNode", node: artifactStore },
    { type: "addEdge", edge: apiTriggersOrchestrator },
    { type: "addEdge", edge: orchestratorBindsWorkflow },
    { type: "addEdge", edge: orchestratorBindsStateStore },
    { type: "addEdge", edge: workerBindsStateStore },
    { type: "addEdge", edge: workerBindsArtifactStore },
  ];
}

/** Variant with excessive maxRecursionDepth on Step Functions node */
function setupBlueprintWithHighRecursion(): ReadonlyArray<GraphMutation> {
  const base = setupBlueprint();
  return base.map((m) => {
    if (m.type === "addNode" && m.node.id === "platform:agent-workflow") {
      return {
        type: "addNode" as const,
        node: createTestNode({
          id: "platform:agent-workflow",
          type: "platform",
          metadata: {
            properties: {
              platform: "aws-stepfunctions",
              type: "STANDARD",
              logging: true,
              logLevel: "ALL",
              maxRecursionDepth: 75,
            },
          },
        }),
      };
    }
    return m;
  });
}

function makeBinders() {
  const registry = new BinderRegistry();
  registry.register(new ComponentPlatformBinder());
  registry.register(new TriggersBinder());
  return registry.getBinders();
}

describe("Golden: Blueprint BP-A09 — Agent Orchestration (SFN)", () => {
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
    expect(ids).toContain("platform:api");
    expect(ids).toContain("component:orchestrator");
    expect(ids).toContain("platform:agent-workflow");
    expect(ids).toContain("component:agent-worker");
    expect(ids).toContain("platform:state-store");
    expect(ids).toContain("platform:artifact-store");
  });

  it("contains all 5 edges", () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: "Baseline" },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    expect(compilation.snapshot.edges).toHaveLength(5);
  });

  it("emits IAM and config intents from component→platform bindings", () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: "Baseline" },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    const intentTypes = compilation.intents.map((i) => i.type);
    expect(intentTypes).toContain("iam");
    expect(intentTypes).toContain("config");
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

    it("stepfunctions-logging-disabled does not fire (logging: true)", () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: "Baseline" },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const logViolations = compilation.policy?.violations.filter(
        (v) => v.ruleId === "stepfunctions-logging-disabled",
      );
      expect(logViolations).toHaveLength(0);
    });

    it("telemetry-tracing-disabled does not fire (tracing: true)", () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: "Baseline" },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const tracingViolations = compilation.policy?.violations.filter(
        (v) => v.ruleId === "telemetry-tracing-disabled",
      );
      expect(tracingViolations).toHaveLength(0);
    });

    it("sfn-max-recursion does not fire (no maxRecursionDepth set)", () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: "Baseline" },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const recursionViolations = compilation.policy?.violations.filter(
        (v) => v.ruleId === "sfn-max-recursion",
      );
      expect(recursionViolations).toHaveLength(0);
    });

    it("sfn-max-recursion fires on variant with maxRecursionDepth: 75", () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprintWithHighRecursion,
        config: { policyPack: "Baseline" },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const recursionViolations = compilation.policy?.violations.filter(
        (v) => v.ruleId === "sfn-max-recursion",
      );
      expect(recursionViolations).toHaveLength(1);
      expect(recursionViolations?.[0]?.severity).toBe("warning");
    });

    it("FedRAMP-High escalates IAM violations to error", () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: "FedRAMP-High" },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const iamViolations = compilation.policy?.violations.filter(
        (v) => v.ruleId === "iam-missing-conditions",
      );
      for (const v of iamViolations ?? []) {
        expect(v.severity).toBe("error");
      }
    });

    it("FedRAMP-High escalates sfn-max-recursion to error on variant", () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprintWithHighRecursion,
        config: { policyPack: "FedRAMP-High" },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const recursionViolations = compilation.policy?.violations.filter(
        (v) => v.ruleId === "sfn-max-recursion",
      );
      expect(recursionViolations).toHaveLength(1);
      expect(recursionViolations?.[0]?.severity).toBe("error");
    });
  });
});
