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
 * Golden test for Blueprint BP-I14: Centralized Logging
 *
 * Architecture:
 *   Log Subscription Filter → Firehose → OpenSearch Domain
 *   S3 backup, KMS encryption, VPC networking
 *
 * Platform-only blueprint — bindsTo edges between platform nodes
 * produce zero intents.
 *
 * Gates: determinism (G-001), compilation (G-002), policy evaluation
 */

function setupBlueprint(): ReadonlyArray<GraphMutation> {
  const appVpc = createTestNode({
    id: "platform:app-vpc",
    type: "platform",
    metadata: { properties: { platform: "aws-vpc", cidrBlock: "10.0.0.0/16" } },
  });

  const dataSubnet = createTestNode({
    id: "platform:data-subnet",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-subnet",
        vpcId: "platform:app-vpc",
        cidrBlock: "10.0.10.0/24",
        availabilityZone: "us-east-1a",
      },
    },
  });

  const dataSg = createTestNode({
    id: "platform:data-sg",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-security-group",
        vpcId: "platform:app-vpc",
        description: "OpenSearch and Firehose security group",
      },
    },
  });

  const encryptionKey = createTestNode({
    id: "platform:encryption-key",
    type: "platform",
    metadata: { properties: { platform: "aws-kms", enableKeyRotation: true } },
  });

  const alertTopic = createTestNode({
    id: "platform:alert-topic",
    type: "platform",
    metadata: { properties: { platform: "aws-sns" } },
  });

  const backupBucket = createTestNode({
    id: "platform:backup-bucket",
    type: "platform",
    metadata: { properties: { platform: "aws-s3", versioning: true } },
  });

  const opensearch = createTestNode({
    id: "platform:opensearch",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-opensearch",
        engineVersion: "OpenSearch_2.11",
        instanceType: "t3.small.search",
        instanceCount: 2,
        ebsEnabled: true,
        volumeSize: 50,
        encryptionAtRest: true,
        nodeToNodeEncryption: true,
        enforceHTTPS: true,
        publicAccess: false,
        subnetIds: ["platform:data-subnet"],
        securityGroupIds: ["platform:data-sg"],
      },
    },
  });

  const firehose = createTestNode({
    id: "platform:firehose",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-kinesis-firehose",
        destinationType: "opensearch",
        encryptionEnabled: true,
        bufferingIntervalSeconds: 60,
        bufferingSizeMBs: 5,
        s3BackupMode: "FailedDocumentsOnly",
        indexName: "logs",
      },
    },
  });

  const appLogs = createTestNode({
    id: "platform:app-logs",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-log-subscription-filter",
        filterPattern: "",
      },
    },
  });

  const firehoseToOpensearch = createTestEdge({
    id: "edge:bindsTo:platform:firehose:platform:opensearch",
    type: "bindsTo",
    source: firehose.id,
    target: opensearch.id,
    metadata: {
      bindingConfig: {
        resourceType: "domain",
        accessLevel: "write",
      },
    },
  });

  const firehoseToBackup = createTestEdge({
    id: "edge:bindsTo:platform:firehose:platform:backup-bucket",
    type: "bindsTo",
    source: firehose.id,
    target: backupBucket.id,
    metadata: {
      bindingConfig: {
        resourceType: "bucket",
        accessLevel: "write",
      },
    },
  });

  return [
    { type: "addNode", node: appVpc },
    { type: "addNode", node: dataSubnet },
    { type: "addNode", node: dataSg },
    { type: "addNode", node: encryptionKey },
    { type: "addNode", node: alertTopic },
    { type: "addNode", node: backupBucket },
    { type: "addNode", node: opensearch },
    { type: "addNode", node: firehose },
    { type: "addNode", node: appLogs },
    { type: "addEdge", edge: firehoseToOpensearch },
    { type: "addEdge", edge: firehoseToBackup },
  ];
}

function makeBinders() {
  const registry = new BinderRegistry();
  registry.register(new ComponentPlatformBinder());
  registry.register(new TriggersBinder());
  return registry.getBinders();
}

describe("Golden: Blueprint BP-I14 — Centralized Logging", () => {
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

  it("contains all 9 nodes", () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: "Baseline" },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    expect(compilation.snapshot.nodes).toHaveLength(9);
    const ids = compilation.snapshot.nodes.map((n) => n.id);
    expect(ids).toContain("platform:app-vpc");
    expect(ids).toContain("platform:data-subnet");
    expect(ids).toContain("platform:data-sg");
    expect(ids).toContain("platform:encryption-key");
    expect(ids).toContain("platform:alert-topic");
    expect(ids).toContain("platform:backup-bucket");
    expect(ids).toContain("platform:opensearch");
    expect(ids).toContain("platform:firehose");
    expect(ids).toContain("platform:app-logs");
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

  it("emits zero intents (platform-only edges)", () => {
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

    it("firehose-encryption-disabled does not fire (encryption enabled)", () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: "Baseline" },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const violations = compilation.policy?.violations.filter(
        (v) => v.ruleId === "firehose-encryption-disabled",
      );
      expect(violations).toHaveLength(0);
    });
  });
});
