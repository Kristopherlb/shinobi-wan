import { describe, it, expect } from 'vitest';
import { createTestNode, createTestEdge } from '@shinobi/ir';
import type { GraphMutation } from '@shinobi/ir';
import { ComponentPlatformBinder, TriggersBinder, BinderRegistry } from '@shinobi/binder';
import { BaselinePolicyEvaluator } from '@shinobi/policy';
import { runGoldenCase } from '../golden-runner';

/**
 * Golden test for Blueprint BP-I18: Cost Optimization
 *
 * Architecture:
 *   Budget → SNS alerts
 *   Config Rule → Lambda remediation
 *   Lambda → S3 cost reports
 *
 * Mixed blueprint: platform + component nodes.
 * config-rule→lambda triggers edge produces intents.
 * component→platform bindsTo produces IAM + network + config intents.
 *
 * Gates: determinism (G-001), compilation (G-002), policy evaluation
 */

function setupBlueprint(): ReadonlyArray<GraphMutation> {
  const costAlerts = createTestNode({
    id: 'platform:cost-alerts',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-sns',
      },
    },
  });

  const monthlyBudget = createTestNode({
    id: 'platform:monthly-budget',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-budgets',
        budgetType: 'COST',
        limitAmount: '1000',
        limitUnit: 'USD',
        timeUnit: 'MONTHLY',
        thresholdPercentage: 80,
        notificationTopicArn: 'platform:cost-alerts',
      },
    },
  });

  const s3EncryptionCheck = createTestNode({
    id: 'platform:s3-encryption-check',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-config-rules',
        source: {
          owner: 'AWS',
          sourceIdentifier: 'S3_BUCKET_SERVER_SIDE_ENCRYPTION_ENABLED',
        },
        maximumExecutionFrequency: 'TwentyFour_Hours',
      },
    },
  });

  const remediationHandler = createTestNode({
    id: 'component:remediation-handler',
    type: 'component',
    metadata: {
      properties: {
        platform: 'aws-lambda',
        runtime: 'nodejs20.x',
        handler: 'remediation.handler',
        memorySize: 256,
        timeout: 60,
        tracing: true,
      },
    },
  });

  const costReports = createTestNode({
    id: 'platform:cost-reports',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-s3',
        versioning: true,
      },
    },
  });

  const budgetToAlerts = createTestEdge({
    id: 'edge:bindsTo:platform:monthly-budget:platform:cost-alerts',
    type: 'bindsTo',
    source: monthlyBudget.id,
    target: costAlerts.id,
    metadata: {
      bindingConfig: {
        resourceType: 'topic',
        accessLevel: 'write',
      },
    },
  });

  const configToLambda = createTestEdge({
    id: 'edge:triggers:platform:s3-encryption-check:component:remediation-handler',
    type: 'triggers',
    source: s3EncryptionCheck.id,
    target: remediationHandler.id,
    metadata: {
      bindingConfig: {
        resourceType: 'config-rule',
        route: '/remediate',
        method: 'POST',
      },
    },
  });

  const lambdaToS3 = createTestEdge({
    id: 'edge:bindsTo:component:remediation-handler:platform:cost-reports',
    type: 'bindsTo',
    source: remediationHandler.id,
    target: costReports.id,
    metadata: {
      bindingConfig: {
        resourceType: 'bucket',
        accessLevel: 'write',
        network: { port: 443, protocol: 'tcp' },
        configKeys: [
          { key: 'REPORTS_BUCKET', valueSource: { type: 'reference', nodeRef: 'cost-reports', field: 'bucket' } },
        ],
      },
    },
  });

  return [
    { type: 'addNode', node: costAlerts },
    { type: 'addNode', node: monthlyBudget },
    { type: 'addNode', node: s3EncryptionCheck },
    { type: 'addNode', node: remediationHandler },
    { type: 'addNode', node: costReports },
    { type: 'addEdge', edge: budgetToAlerts },
    { type: 'addEdge', edge: configToLambda },
    { type: 'addEdge', edge: lambdaToS3 },
  ];
}

function makeBinders() {
  const registry = new BinderRegistry();
  registry.register(new ComponentPlatformBinder());
  registry.register(new TriggersBinder());
  return registry.getBinders();
}

describe('Golden: Blueprint BP-I18 — Cost Optimization', () => {
  const evaluator = new BaselinePolicyEvaluator();

  it('compiles successfully', () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: 'Baseline' },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    expect(compilation.validation.valid).toBe(true);
  });

  it('contains all 5 nodes', () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: 'Baseline' },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    expect(compilation.snapshot.nodes).toHaveLength(5);
    const ids = compilation.snapshot.nodes.map((n) => n.id);
    expect(ids).toContain('platform:cost-alerts');
    expect(ids).toContain('platform:monthly-budget');
    expect(ids).toContain('platform:s3-encryption-check');
    expect(ids).toContain('component:remediation-handler');
    expect(ids).toContain('platform:cost-reports');
  });

  it('contains 3 edges', () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: 'Baseline' },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    expect(compilation.snapshot.edges).toHaveLength(3);
  });

  it('emits intents from component→platform and triggers edges', () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: 'Baseline' },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    expect(compilation.intents.length).toBeGreaterThan(0);
    const types = compilation.intents.map((i) => i.type);
    expect(types).toContain('iam');
  });

  it('determinism: identical output across two runs', () => {
    const opts = {
      setup: setupBlueprint,
      config: { policyPack: 'Baseline' },
      binders: makeBinders(),
      evaluators: [evaluator],
    };

    const r1 = runGoldenCase(opts);
    const r2 = runGoldenCase(opts);
    expect(r1.serialized).toBe(r2.serialized);
  });

  describe('policy evaluation across packs', () => {
    it.each(['Baseline', 'FedRAMP-Moderate', 'FedRAMP-High'] as const)(
      'evaluates with pack %s without throwing',
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

    it('budget-threshold-missing does not fire (threshold set)', () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: 'Baseline' },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const violations = compilation.policy?.violations.filter(
        (v) => v.ruleId === 'budget-threshold-missing',
      );
      expect(violations).toHaveLength(0);
    });
  });
});
