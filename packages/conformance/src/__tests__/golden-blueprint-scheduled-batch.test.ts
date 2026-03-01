import { describe, it, expect } from 'vitest';
import { createTestNode, createTestEdge } from '@shinobi/ir';
import type { GraphMutation } from '@shinobi/ir';
import { ComponentPlatformBinder, TriggersBinder, BinderRegistry } from '@shinobi/binder';
import { BaselinePolicyEvaluator } from '@shinobi/policy';
import { runGoldenCase } from '../golden-runner';

/**
 * Golden test for Blueprint BP-007: Scheduled Batch Processing
 *
 * Architecture:
 *   EventBridge Scheduler → Step Functions → Lambda (workers) → S3
 *
 * Gates: determinism (G-001), compilation (G-002), policy evaluation
 */

function setupBlueprint(): ReadonlyArray<GraphMutation> {
  const dailyTrigger = createTestNode({
    id: 'platform:daily-trigger',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-eventbridge-scheduler',
        scheduleExpression: 'cron(0 2 * * ? *)',
        flexibleTimeWindow: 'FLEXIBLE',
        retryPolicy: {
          maximumRetryAttempts: 2,
          maximumEventAgeInSeconds: 3600,
        },
      },
    },
  });

  const batchWorkflow = createTestNode({
    id: 'platform:batch-workflow',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-stepfunctions',
        type: 'STANDARD',
        logging: true,
        logLevel: 'ALL',
      },
    },
  });

  const batchWorker = createTestNode({
    id: 'component:batch-worker',
    type: 'component',
    metadata: {
      properties: {
        platform: 'aws-lambda',
        runtime: 'nodejs20.x',
        handler: 'worker.handler',
        memorySize: 1024,
        timeout: 300,
        tracing: true,
      },
    },
  });

  const batchOutput = createTestNode({
    id: 'platform:batch-output',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-s3',
        versioning: true,
      },
    },
  });

  const triggerBindsWorkflow = createTestEdge({
    id: 'edge:triggers:platform:daily-trigger:platform:batch-workflow',
    type: 'triggers',
    source: dailyTrigger.id,
    target: batchWorkflow.id,
    metadata: {
      bindingConfig: {
        resourceType: 'statemachine',
        network: { port: 443, protocol: 'tcp' },
      },
    },
  });

  const workerBindsBucket = createTestEdge({
    id: 'edge:bindsTo:component:batch-worker:platform:batch-output',
    type: 'bindsTo',
    source: batchWorker.id,
    target: batchOutput.id,
    metadata: {
      bindingConfig: {
        resourceType: 'bucket',
        accessLevel: 'write',
        network: { port: 443, protocol: 'tcp' },
        configKeys: [
          { key: 'OUTPUT_BUCKET', valueSource: { type: 'reference', nodeRef: 'batch-output', field: 'bucket' } },
        ],
      },
    },
  });

  return [
    { type: 'addNode', node: dailyTrigger },
    { type: 'addNode', node: batchWorkflow },
    { type: 'addNode', node: batchWorker },
    { type: 'addNode', node: batchOutput },
    { type: 'addEdge', edge: triggerBindsWorkflow },
    { type: 'addEdge', edge: workerBindsBucket },
  ];
}

function makeBinders() {
  const registry = new BinderRegistry();
  registry.register(new ComponentPlatformBinder());
  registry.register(new TriggersBinder());
  return registry.getBinders();
}

describe('Golden: Blueprint BP-007 — Scheduled Batch Processing', () => {
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

  it('contains all 4 nodes', () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: 'Baseline' },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    expect(compilation.snapshot.nodes).toHaveLength(4);
    const ids = compilation.snapshot.nodes.map((n) => n.id);
    expect(ids).toContain('platform:daily-trigger');
    expect(ids).toContain('platform:batch-workflow');
    expect(ids).toContain('component:batch-worker');
    expect(ids).toContain('platform:batch-output');
  });

  it('contains all 2 edges', () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: 'Baseline' },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    expect(compilation.snapshot.edges).toHaveLength(2);
  });

  it('emits IAM and config intents from worker→S3 binding', () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: 'Baseline' },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    const intentTypes = compilation.intents.map((i) => i.type);
    expect(intentTypes).toContain('iam');
    expect(intentTypes).toContain('config');
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

    it('eventbridge-retry-missing does not fire when retryPolicy is set', () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: 'Baseline' },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const retryViolations = compilation.policy?.violations.filter(
        (v) => v.ruleId === 'eventbridge-retry-missing',
      );
      expect(retryViolations).toHaveLength(0);
    });

    it('stepfunctions-logging-disabled does not fire when logging is true', () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: 'Baseline' },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const logViolations = compilation.policy?.violations.filter(
        (v) => v.ruleId === 'stepfunctions-logging-disabled',
      );
      expect(logViolations).toHaveLength(0);
    });

    it('tracing-disabled does not fire when tracing is enabled', () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: 'Baseline' },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const tracingViolations = compilation.policy?.violations.filter(
        (v) => v.ruleId === 'telemetry-tracing-disabled',
      );
      expect(tracingViolations).toHaveLength(0);
    });

    it('FedRAMP-High escalates IAM violations to error severity', () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: 'FedRAMP-High' },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const iamViolations = compilation.policy?.violations.filter(
        (v) => v.ruleId === 'iam-missing-conditions',
      );
      for (const v of iamViolations ?? []) {
        expect(v.severity).toBe('error');
      }
    });
  });
});
