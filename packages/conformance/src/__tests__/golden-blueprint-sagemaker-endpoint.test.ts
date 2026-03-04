import { describe, it, expect } from 'vitest';
import { createTestNode, createTestEdge } from '@shinobi/ir';
import type { GraphMutation } from '@shinobi/ir';
import { ComponentPlatformBinder, TriggersBinder, BinderRegistry } from '@shinobi/binder';
import { BaselinePolicyEvaluator } from '@shinobi/policy';
import { runGoldenCase } from '../golden-runner';

/**
 * Golden test for Blueprint BP-A03: SageMaker Endpoint
 *
 * Architecture:
 *   SageMaker Endpoint (Model + Config + Endpoint)
 *   S3 for model artifacts
 *   Lambda invoker function
 *   VPC + Subnet
 *
 * Mixed blueprint: 1 component node (invoker) + 4 platform nodes.
 * Component→platform bindsTo edges produce intents.
 *
 * Gates: determinism (G-001), compilation (G-002), intent generation, policy evaluation
 */

function setupBlueprint(): ReadonlyArray<GraphMutation> {
  const appVpc = createTestNode({
    id: 'platform:app-vpc',
    type: 'platform',
    metadata: { properties: { platform: 'aws-vpc', cidrBlock: '10.0.0.0/16' } },
  });

  const modelSubnet = createTestNode({
    id: 'platform:model-subnet',
    type: 'platform',
    metadata: { properties: { platform: 'aws-subnet', vpcId: 'platform:app-vpc', cidrBlock: '10.0.10.0/24', availabilityZone: 'us-east-1a' } },
  });

  const modelArtifacts = createTestNode({
    id: 'platform:model-artifacts',
    type: 'platform',
    metadata: { properties: { platform: 'aws-s3', versioning: true } },
  });

  const modelEndpoint = createTestNode({
    id: 'platform:model-endpoint',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-sagemaker-endpoint',
        modelImage: '123456789.dkr.ecr.us-east-1.amazonaws.com/my-model:latest',
        modelDataUrl: 's3://model-artifacts/model.tar.gz',
        instanceType: 'ml.m5.large',
        initialInstanceCount: 1,
        vpcConfig: {
          subnetIds: ['platform:model-subnet'],
          securityGroupIds: [],
        },
      },
    },
  });

  const invoker = createTestNode({
    id: 'component:invoker',
    type: 'component',
    metadata: {
      properties: {
        platform: 'aws-lambda',
        runtime: 'nodejs20.x',
        handler: 'invoke.handler',
        memorySize: 512,
        timeout: 60,
        tracing: true,
      },
    },
  });

  const invokerToEndpoint = createTestEdge({
    id: 'edge:bindsTo:component:invoker:platform:model-endpoint',
    type: 'bindsTo',
    source: invoker.id,
    target: modelEndpoint.id,
    metadata: {
      bindingConfig: {
        resourceType: 'endpoint',
        accessLevel: 'write',
        network: { port: 443, protocol: 'tcp' },
        configKeys: [
          { key: 'ENDPOINT_NAME', valueSource: { type: 'reference', nodeRef: 'model-endpoint', field: 'arn' } },
        ],
      },
    },
  });

  const invokerToArtifacts = createTestEdge({
    id: 'edge:bindsTo:component:invoker:platform:model-artifacts',
    type: 'bindsTo',
    source: invoker.id,
    target: modelArtifacts.id,
    metadata: {
      bindingConfig: {
        resourceType: 'bucket',
        accessLevel: 'read',
        network: { port: 443, protocol: 'tcp' },
        configKeys: [
          { key: 'MODEL_BUCKET', valueSource: { type: 'reference', nodeRef: 'model-artifacts', field: 'bucket' } },
        ],
      },
    },
  });

  return [
    { type: 'addNode', node: appVpc },
    { type: 'addNode', node: modelSubnet },
    { type: 'addNode', node: modelArtifacts },
    { type: 'addNode', node: modelEndpoint },
    { type: 'addNode', node: invoker },
    { type: 'addEdge', edge: invokerToEndpoint },
    { type: 'addEdge', edge: invokerToArtifacts },
  ];
}

function makeBinders() {
  const registry = new BinderRegistry();
  registry.register(new ComponentPlatformBinder());
  registry.register(new TriggersBinder());
  return registry.getBinders();
}

describe('Golden: Blueprint BP-A03 — SageMaker Endpoint', () => {
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
    expect(ids).toContain('platform:app-vpc');
    expect(ids).toContain('platform:model-subnet');
    expect(ids).toContain('platform:model-artifacts');
    expect(ids).toContain('platform:model-endpoint');
    expect(ids).toContain('component:invoker');
  });

  it('contains 2 edges', () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: 'Baseline' },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    expect(compilation.snapshot.edges).toHaveLength(2);
  });

  it('emits intents (component→platform edges)', () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: 'Baseline' },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    expect(compilation.intents.length).toBeGreaterThan(0);
    const types = compilation.intents.map((i) => i.type);
    expect(types).toContain('iam');
    expect(types).toContain('network');
    expect(types).toContain('config');
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

    it('sagemaker-vpc-disabled does not fire (vpcConfig has subnets)', () => {
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
  });
});
