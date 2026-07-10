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
 * Golden test for Blueprint BP-A16: ML Training Pipeline
 *
 * Architecture:
 *   VPC + Subnet + Security Group + KMS
 *   S3 (training-data, model-artifacts)
 *   SageMaker Pipeline + SageMaker Endpoint
 *
 * Platform-only blueprint — edges produce zero intents.
 *
 * Gates: determinism (G-001), compilation (G-002), policy evaluation
 */

function setupBlueprint(): ReadonlyArray<GraphMutation> {
  const mlVpc = createTestNode({
    id: "platform:ml-vpc",
    type: "platform",
    metadata: { properties: { platform: "aws-vpc", cidrBlock: "10.0.0.0/16" } },
  });

  const mlSubnet = createTestNode({
    id: "platform:ml-subnet",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-subnet",
        vpcId: "platform:ml-vpc",
        cidrBlock: "10.0.1.0/24",
        availabilityZone: "us-east-1a",
        mapPublicIpOnLaunch: false,
      },
    },
  });

  const mlSg = createTestNode({
    id: "platform:ml-sg",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-security-group",
        vpcId: "platform:ml-vpc",
        description: "ML SG",
      },
    },
  });

  const encryptionKey = createTestNode({
    id: "platform:encryption-key",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-kms",
        description: "ML key",
        enableKeyRotation: true,
      },
    },
  });

  const trainingData = createTestNode({
    id: "platform:training-data",
    type: "platform",
    metadata: { properties: { platform: "aws-s3", versioning: true } },
  });

  const modelArtifacts = createTestNode({
    id: "platform:model-artifacts",
    type: "platform",
    metadata: { properties: { platform: "aws-s3", versioning: true } },
  });

  const trainingPipeline = createTestNode({
    id: "platform:training-pipeline",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-sagemaker-pipeline",
        pipelineDefinition: '{"Version": "2020-12-01", "Steps": []}',
        pipelineDescription: "Training pipeline for model v1",
        parallelismConfiguration: { maxParallelExecutionSteps: 3 },
      },
    },
  });

  const modelEndpoint = createTestNode({
    id: "platform:model-endpoint",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-sagemaker-endpoint",
        instanceType: "ml.m5.large",
        initialInstanceCount: 1,
        vpcConfig: {
          subnetIds: ["platform:ml-subnet"],
          securityGroupIds: ["platform:ml-sg"],
        },
      },
    },
  });

  const pipelineReadsData = createTestEdge({
    id: "edge:bindsTo:platform:training-pipeline:platform:training-data",
    type: "bindsTo",
    source: trainingPipeline.id,
    target: trainingData.id,
    metadata: {
      bindingConfig: { resourceType: "bucket", accessLevel: "read" },
    },
  });

  const pipelineWritesArtifacts = createTestEdge({
    id: "edge:bindsTo:platform:training-pipeline:platform:model-artifacts",
    type: "bindsTo",
    source: trainingPipeline.id,
    target: modelArtifacts.id,
    metadata: {
      bindingConfig: { resourceType: "bucket", accessLevel: "write" },
    },
  });

  return [
    { type: "addNode", node: mlVpc },
    { type: "addNode", node: mlSubnet },
    { type: "addNode", node: mlSg },
    { type: "addNode", node: encryptionKey },
    { type: "addNode", node: trainingData },
    { type: "addNode", node: modelArtifacts },
    { type: "addNode", node: trainingPipeline },
    { type: "addNode", node: modelEndpoint },
    { type: "addEdge", edge: pipelineReadsData },
    { type: "addEdge", edge: pipelineWritesArtifacts },
  ];
}

function makeBinders() {
  const registry = new BinderRegistry();
  registry.register(new ComponentPlatformBinder());
  registry.register(new TriggersBinder());
  return registry.getBinders();
}

describe("Golden: Blueprint BP-A16 — ML Training Pipeline", () => {
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

  it("contains all 8 nodes", () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: "Baseline" },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    expect(compilation.snapshot.nodes).toHaveLength(8);
    const ids = compilation.snapshot.nodes.map((n) => n.id);
    expect(ids).toContain("platform:ml-vpc");
    expect(ids).toContain("platform:ml-subnet");
    expect(ids).toContain("platform:ml-sg");
    expect(ids).toContain("platform:encryption-key");
    expect(ids).toContain("platform:training-data");
    expect(ids).toContain("platform:model-artifacts");
    expect(ids).toContain("platform:training-pipeline");
    expect(ids).toContain("platform:model-endpoint");
  });

  it("contains 2 edges", () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: "Baseline" },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    expect(compilation.snapshot.edges).toHaveLength(2);
  });

  it("emits zero intents (platform-to-platform edges)", () => {
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

    it("sagemaker-pipeline-parallelism-missing does not fire (config set)", () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: "Baseline" },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const violations = compilation.policy?.violations.filter(
        (v) => v.ruleId === "sagemaker-pipeline-parallelism-missing",
      );
      expect(violations).toHaveLength(0);
    });
  });
});
