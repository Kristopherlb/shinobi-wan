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
 * Golden test for Blueprint BP-I01: Account Bootstrap
 *
 * Architecture:
 *   AWS Config Recorder + Security Hub + GuardDuty + CloudTrail
 *   S3 for audit logs, KMS for encryption, SNS for alerts
 *   Config Rules, Budgets, SecretsManager
 *
 * Pure enablement blueprint — 10 nodes, zero edges, zero intents.
 * All nodes are platform type with no inter-node bindings.
 *
 * Gates: determinism (G-001), compilation (G-002), policy evaluation
 */

function setupBlueprint(): ReadonlyArray<GraphMutation> {
  const configRecorder = createTestNode({
    id: "platform:config-recorder",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-config-recorder",
        recordingEnabled: true,
        allSupported: true,
        includeGlobalResourceTypes: true,
        deliveryFrequency: "TwentyFour_Hours",
      },
    },
  });

  const securityHub = createTestNode({
    id: "platform:security-hub",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-securityhub",
        enableDefaultStandards: true,
      },
    },
  });

  const guardduty = createTestNode({
    id: "platform:guardduty",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-guardduty",
        enabled: true,
        findingPublishingFrequency: "FIFTEEN_MINUTES",
        s3DataSource: true,
      },
    },
  });

  const cloudtrail = createTestNode({
    id: "platform:cloudtrail",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-cloudtrail",
        isMultiRegionTrail: true,
        enableLogFileValidation: true,
        includeGlobalServiceEvents: true,
        cloudWatchLogsEnabled: true,
        logRetentionDays: 90,
      },
    },
  });

  const auditLogs = createTestNode({
    id: "platform:audit-logs",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-s3",
        versioning: true,
      },
    },
  });

  const encryptionKey = createTestNode({
    id: "platform:encryption-key",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-kms",
        enableKeyRotation: true,
      },
    },
  });

  const alertTopic = createTestNode({
    id: "platform:alert-topic",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-sns",
      },
    },
  });

  const configRules = createTestNode({
    id: "platform:config-rules",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-config-rules",
        rules: [
          {
            name: "s3-bucket-versioning-enabled",
            source: "AWS",
            sourceIdentifier: "S3_BUCKET_VERSIONING_ENABLED",
          },
          {
            name: "iam-root-access-key-check",
            source: "AWS",
            sourceIdentifier: "IAM_ROOT_ACCESS_KEY_CHECK",
          },
        ],
      },
    },
  });

  const costBudget = createTestNode({
    id: "platform:cost-budget",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-budgets",
        budgetType: "COST",
        limitAmount: 1000,
        limitUnit: "USD",
        timeUnit: "MONTHLY",
        thresholdPercentage: 80,
        notificationTopicArn: "platform:alert-topic",
      },
    },
  });

  const trailSecret = createTestNode({
    id: "platform:trail-secret",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-secretsmanager",
        rotationEnabled: true,
        rotationDays: 90,
      },
    },
  });

  return [
    { type: "addNode", node: configRecorder },
    { type: "addNode", node: securityHub },
    { type: "addNode", node: guardduty },
    { type: "addNode", node: cloudtrail },
    { type: "addNode", node: auditLogs },
    { type: "addNode", node: encryptionKey },
    { type: "addNode", node: alertTopic },
    { type: "addNode", node: configRules },
    { type: "addNode", node: costBudget },
    { type: "addNode", node: trailSecret },
  ];
}

function makeBinders() {
  const registry = new BinderRegistry();
  registry.register(new ComponentPlatformBinder());
  registry.register(new TriggersBinder());
  return registry.getBinders();
}

describe("Golden: Blueprint BP-I01 — Account Bootstrap", () => {
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

  it("contains all 10 nodes", () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: "Baseline" },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    expect(compilation.snapshot.nodes).toHaveLength(10);
    const ids = compilation.snapshot.nodes.map((n) => n.id);
    expect(ids).toContain("platform:config-recorder");
    expect(ids).toContain("platform:security-hub");
    expect(ids).toContain("platform:guardduty");
    expect(ids).toContain("platform:cloudtrail");
    expect(ids).toContain("platform:audit-logs");
    expect(ids).toContain("platform:encryption-key");
    expect(ids).toContain("platform:alert-topic");
    expect(ids).toContain("platform:config-rules");
    expect(ids).toContain("platform:cost-budget");
    expect(ids).toContain("platform:trail-secret");
  });

  it("contains zero edges (pure enablement blueprint)", () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: "Baseline" },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    expect(compilation.snapshot.edges).toHaveLength(0);
  });

  it("emits zero intents (no edges)", () => {
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

    it("cloudtrail-log-validation-disabled does not fire (validation enabled)", () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: "Baseline" },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const violations = compilation.policy?.violations.filter(
        (v) => v.ruleId === "cloudtrail-log-validation-disabled",
      );
      expect(violations).toHaveLength(0);
    });

    it("guardduty-not-enabled does not fire (enabled=true)", () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: "Baseline" },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const violations = compilation.policy?.violations.filter(
        (v) => v.ruleId === "guardduty-not-enabled",
      );
      expect(violations).toHaveLength(0);
    });

    it("kms-key-rotation-disabled does not fire (rotation enabled)", () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: "Baseline" },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const violations = compilation.policy?.violations.filter(
        (v) => v.ruleId === "kms-key-rotation-disabled",
      );
      expect(violations).toHaveLength(0);
    });

    it("secrets-rotation-disabled does not fire (rotation enabled)", () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: "Baseline" },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const violations = compilation.policy?.violations.filter(
        (v) => v.ruleId === "secrets-rotation-disabled",
      );
      expect(violations).toHaveLength(0);
    });

    it("FedRAMP-High escalates guardduty-not-enabled to error when disabled", () => {
      const disabledGuardDuty = createTestNode({
        id: "platform:insecure-guardduty",
        type: "platform",
        metadata: {
          properties: {
            platform: "aws-guardduty",
            enabled: false,
          },
        },
      });

      const mutations: ReadonlyArray<GraphMutation> = [
        { type: "addNode", node: disabledGuardDuty },
      ];

      const { compilation } = runGoldenCase({
        setup: () => mutations,
        config: { policyPack: "FedRAMP-High" },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const violations = compilation.policy?.violations.filter(
        (v) => v.ruleId === "guardduty-not-enabled",
      );
      expect(violations?.length).toBeGreaterThanOrEqual(1);
      for (const v of violations ?? []) {
        expect(v.severity).toBe("error");
      }
    });
  });
});
