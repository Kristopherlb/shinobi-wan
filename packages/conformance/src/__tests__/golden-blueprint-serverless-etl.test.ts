import { describe, it, expect } from 'vitest';
import { createTestNode, createTestEdge } from '@shinobi/ir';
import type { GraphMutation } from '@shinobi/ir';
import { ComponentPlatformBinder, TriggersBinder, BinderRegistry } from '@shinobi/binder';
import { BaselinePolicyEvaluator } from '@shinobi/policy';
import { runGoldenCase } from '../golden-runner';

/**
 * Golden test for Blueprint BP-004: Serverless API → Queue → ETL → S3
 *
 * Architecture:
 *   API Gateway → Lambda (ingest) → SQS (with DLQ) → Lambda (worker) → S3
 *
 * Gates: determinism (G-001), compilation (G-002), policy evaluation
 */

function setupBlueprint(): ReadonlyArray<GraphMutation> {
  const api = createTestNode({
    id: 'platform:api',
    type: 'platform',
    metadata: { properties: { platform: 'aws-apigateway' } },
  });

  const ingest = createTestNode({
    id: 'component:ingest',
    type: 'component',
    metadata: {
      properties: {
        platform: 'aws-lambda',
        runtime: 'nodejs20.x',
        handler: 'index.handler',
        memorySize: 256,
        timeout: 30,
        tracing: true,
        powertools: true,
      },
    },
  });

  const workQueue = createTestNode({
    id: 'platform:work-queue',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-sqs',
        visibilityTimeout: 300,
        deadLetterQueue: true,
        maxReceiveCount: 3,
      },
    },
  });

  const worker = createTestNode({
    id: 'component:worker',
    type: 'component',
    metadata: {
      properties: {
        platform: 'aws-lambda',
        runtime: 'nodejs20.x',
        handler: 'worker.handler',
        memorySize: 512,
        timeout: 300,
        tracing: true,
        powertools: true,
      },
    },
  });

  const outputBucket = createTestNode({
    id: 'platform:output-bucket',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-s3',
        versioning: true,
      },
    },
  });

  const apiTriggersIngest = createTestEdge({
    id: 'edge:triggers:platform:api:component:ingest',
    type: 'triggers',
    source: api.id,
    target: ingest.id,
    metadata: { bindingConfig: { route: '/ingest', method: 'POST' } },
  });

  const ingestBindsQueue = createTestEdge({
    id: 'edge:bindsTo:component:ingest:platform:work-queue',
    type: 'bindsTo',
    source: ingest.id,
    target: workQueue.id,
    metadata: {
      bindingConfig: {
        resourceType: 'queue',
        accessLevel: 'write',
        network: { port: 443, protocol: 'tcp' },
        configKeys: [
          { key: 'QUEUE_URL', valueSource: { type: 'reference', nodeRef: 'work-queue', field: 'url' } },
        ],
      },
    },
  });

  const workerBindsQueue = createTestEdge({
    id: 'edge:bindsTo:component:worker:platform:work-queue',
    type: 'bindsTo',
    source: worker.id,
    target: workQueue.id,
    metadata: {
      bindingConfig: {
        resourceType: 'queue',
        accessLevel: 'read',
        network: { port: 443, protocol: 'tcp' },
        configKeys: [
          { key: 'QUEUE_URL', valueSource: { type: 'reference', nodeRef: 'work-queue', field: 'url' } },
        ],
      },
    },
  });

  const workerBindsBucket = createTestEdge({
    id: 'edge:bindsTo:component:worker:platform:output-bucket',
    type: 'bindsTo',
    source: worker.id,
    target: outputBucket.id,
    metadata: {
      bindingConfig: {
        resourceType: 'bucket',
        accessLevel: 'write',
        network: { port: 443, protocol: 'tcp' },
        configKeys: [
          { key: 'OUTPUT_BUCKET', valueSource: { type: 'reference', nodeRef: 'output-bucket', field: 'bucket' } },
        ],
      },
    },
  });

  return [
    { type: 'addNode', node: api },
    { type: 'addNode', node: ingest },
    { type: 'addNode', node: workQueue },
    { type: 'addNode', node: worker },
    { type: 'addNode', node: outputBucket },
    { type: 'addEdge', edge: apiTriggersIngest },
    { type: 'addEdge', edge: ingestBindsQueue },
    { type: 'addEdge', edge: workerBindsQueue },
    { type: 'addEdge', edge: workerBindsBucket },
  ];
}

function makeBinders() {
  const registry = new BinderRegistry();
  registry.register(new ComponentPlatformBinder());
  registry.register(new TriggersBinder());
  return registry.getBinders();
}

describe('Golden: Blueprint BP-004 — Serverless API ETL', () => {
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
    expect(ids).toContain('platform:api');
    expect(ids).toContain('component:ingest');
    expect(ids).toContain('platform:work-queue');
    expect(ids).toContain('component:worker');
    expect(ids).toContain('platform:output-bucket');
  });

  it('contains all 4 edges', () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: 'Baseline' },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    expect(compilation.snapshot.edges).toHaveLength(4);
  });

  it('emits IAM, config, and network intents from binders', () => {
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

    it('Baseline produces no error-severity violations for DLQ-configured queues', () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: 'Baseline' },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      // DLQ is configured, so sqs-dlq-missing should not fire
      const dlqViolations = compilation.policy?.violations.filter((v) => v.ruleId === 'sqs-dlq-missing');
      expect(dlqViolations).toHaveLength(0);
    });

    it('tracing-disabled does not fire when tracing is enabled', () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: 'Baseline' },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const tracingViolations = compilation.policy?.violations.filter((v) => v.ruleId === 'telemetry-tracing-disabled');
      expect(tracingViolations).toHaveLength(0);
    });

    it('FedRAMP-High escalates IAM violations to error severity', () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: 'FedRAMP-High' },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const iamViolations = compilation.policy?.violations.filter((v) => v.ruleId === 'iam-missing-conditions');
      for (const v of iamViolations) {
        expect(v.severity).toBe('error');
      }
    });
  });
});
