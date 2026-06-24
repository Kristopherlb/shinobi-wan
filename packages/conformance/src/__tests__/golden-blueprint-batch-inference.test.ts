import { describe, it, expect } from 'vitest';
import { createTestNode, createTestEdge } from '@shinobi/ir';
import type { GraphMutation } from '@shinobi/ir';
import { ComponentPlatformBinder, TriggersBinder, BinderRegistry } from '@shinobi/binder';
import { BaselinePolicyEvaluator } from '@shinobi/policy';
import { runGoldenCase } from '../golden-runner';

/**
 * Golden test for Blueprint BP-A05: Batch Inference Pipeline
 *
 * Architecture:
 *   S3 input → SageMaker Model → S3 output
 *   Step Functions orchestration, Lambda trigger
 *
 * Mixed blueprint: component + platform nodes.
 * component→platform bindsTo produces IAM + network + config intents.
 * platform→platform bindsTo produces zero intents.
 *
 * Gates: determinism (G-001), compilation (G-002), policy evaluation
 */

function setupBlueprint(): ReadonlyArray<GraphMutation> {
  const inputData = createTestNode({
    id: 'platform:input-data',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-s3',
        versioning: true,
      },
    },
  });

  const outputResults = createTestNode({
    id: 'platform:output-results',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-s3',
        versioning: true,
      },
    },
  });

  const inferenceModel = createTestNode({
    id: 'platform:inference-model',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-sagemaker-batch-transform',
        modelImage: '123456789.dkr.ecr.us-east-1.amazonaws.com/inference:latest',
        modelDataUrl: 's3://models/model.tar.gz',
        vpcConfig: {
          subnetIds: ['subnet-1', 'subnet-2'],
          securityGroupIds: ['sg-1'],
        },
      },
    },
  });

  const pipelineWorkflow = createTestNode({
    id: 'platform:pipeline-workflow',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-stepfunctions',
        logging: true,
        type: 'STANDARD',
      },
    },
  });

  const pipelineTrigger = createTestNode({
    id: 'component:pipeline-trigger',
    type: 'component',
    metadata: {
      properties: {
        platform: 'aws-lambda',
        runtime: 'nodejs20.x',
        handler: 'trigger.handler',
        memorySize: 256,
        timeout: 60,
        tracing: true,
      },
    },
  });

  const triggerToWorkflow = createTestEdge({
    id: 'edge:bindsTo:component:pipeline-trigger:platform:pipeline-workflow',
    type: 'bindsTo',
    source: pipelineTrigger.id,
    target: pipelineWorkflow.id,
    metadata: {
      bindingConfig: {
        resourceType: 'statemachine',
        accessLevel: 'write',
        network: { port: 443, protocol: 'tcp' },
        configKeys: [
          { key: 'STATE_MACHINE_ARN', valueSource: { type: 'reference', nodeRef: 'pipeline-workflow', field: 'arn' } },
        ],
      },
    },
  });

  const modelToInput = createTestEdge({
    id: 'edge:bindsTo:platform:inference-model:platform:input-data',
    type: 'bindsTo',
    source: inferenceModel.id,
    target: inputData.id,
    metadata: {
      bindingConfig: {
        resourceType: 'bucket',
        accessLevel: 'read',
      },
    },
  });

  const modelToOutput = createTestEdge({
    id: 'edge:bindsTo:platform:inference-model:platform:output-results',
    type: 'bindsTo',
    source: inferenceModel.id,
    target: outputResults.id,
    metadata: {
      bindingConfig: {
        resourceType: 'bucket',
        accessLevel: 'write',
      },
    },
  });

  return [
    { type: 'addNode', node: inputData },
    { type: 'addNode', node: outputResults },
    { type: 'addNode', node: inferenceModel },
    { type: 'addNode', node: pipelineWorkflow },
    { type: 'addNode', node: pipelineTrigger },
    { type: 'addEdge', edge: triggerToWorkflow },
    { type: 'addEdge', edge: modelToInput },
    { type: 'addEdge', edge: modelToOutput },
  ];
}

function makeBinders() {
  const registry = new BinderRegistry();
  registry.register(new ComponentPlatformBinder());
  registry.register(new TriggersBinder());
  return registry.getBinders();
}

describe('Golden: Blueprint BP-A05 — Batch Inference Pipeline', () => {
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
    expect(ids).toContain('platform:input-data');
    expect(ids).toContain('platform:output-results');
    expect(ids).toContain('platform:inference-model');
    expect(ids).toContain('platform:pipeline-workflow');
    expect(ids).toContain('component:pipeline-trigger');
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

  it('emits intents from component→platform edges', () => {
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

    it('sagemaker-vpc-disabled does not fire (VPC config set)', () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: 'Baseline' },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const violations = compilation.policy?.violations.filter(
        (v) => v.ruleId === 'sagemaker-vpc-disabled',
      );
      expect(violations).toHaveLength(0);
    });

    it('stepfunctions-logging-disabled does not fire (logging enabled)', () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: 'Baseline' },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const violations = compilation.policy?.violations.filter(
        (v) => v.ruleId === 'stepfunctions-logging-disabled',
      );
      expect(violations).toHaveLength(0);
    });
  });
});
