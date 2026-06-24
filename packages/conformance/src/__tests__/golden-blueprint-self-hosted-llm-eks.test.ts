import { describe, it, expect } from 'vitest';
import { createTestNode, createTestEdge } from '@shinobi/ir';
import type { GraphMutation } from '@shinobi/ir';
import { ComponentPlatformBinder, TriggersBinder, BinderRegistry } from '@shinobi/binder';
import { BaselinePolicyEvaluator } from '@shinobi/policy';
import { runGoldenCase } from '../golden-runner';

/**
 * Golden test for Blueprint BP-A02: Self-Hosted LLM on EKS
 *
 * Architecture:
 *   VPC + 2 Subnets + Security Group
 *   EKS Cluster + GPU Node Group + VPC CNI Addon
 *   ECR + S3 + KMS + ALB
 *
 * This is a platform-only blueprint — all nodes are platform type.
 * Platform-to-platform bindsTo edges produce zero intents because
 * ComponentPlatformBinder only fires for component→platform edges.
 *
 * Gates: determinism (G-001), compilation (G-002), policy evaluation
 */

function setupBlueprint(): ReadonlyArray<GraphMutation> {
  const llmVpc = createTestNode({
    id: 'platform:llm-vpc',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-vpc',
        cidrBlock: '10.0.0.0/16',
      },
    },
  });

  const llmSubnet1 = createTestNode({
    id: 'platform:llm-subnet-1',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-subnet',
        vpcId: 'platform:llm-vpc',
        cidrBlock: '10.0.1.0/24',
        availabilityZone: 'us-east-1a',
        mapPublicIpOnLaunch: false,
      },
    },
  });

  const llmSubnet2 = createTestNode({
    id: 'platform:llm-subnet-2',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-subnet',
        vpcId: 'platform:llm-vpc',
        cidrBlock: '10.0.2.0/24',
        availabilityZone: 'us-east-1b',
        mapPublicIpOnLaunch: false,
      },
    },
  });

  const llmSg = createTestNode({
    id: 'platform:llm-sg',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-security-group',
        vpcId: 'platform:llm-vpc',
        description: 'LLM cluster security group',
      },
    },
  });

  const llmCluster = createTestNode({
    id: 'platform:llm-cluster',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-eks-cluster',
        version: '1.29',
        subnetIds: ['platform:llm-subnet-1', 'platform:llm-subnet-2'],
        securityGroupIds: ['platform:llm-sg'],
        endpointPrivateAccess: true,
        endpointPublicAccess: false,
        enabledClusterLogTypes: ['api', 'audit', 'authenticator'],
      },
    },
  });

  const gpuNodes = createTestNode({
    id: 'platform:gpu-nodes',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-eks-gpu-node-group',
        clusterRef: 'platform:llm-cluster',
        instanceTypes: ['g5.xlarge'],
        scalingConfig: { desiredSize: 1, minSize: 0, maxSize: 4 },
        subnetIds: ['platform:llm-subnet-1', 'platform:llm-subnet-2'],
      },
    },
  });

  const vpcCniAddon = createTestNode({
    id: 'platform:vpc-cni-addon',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-eks-addon',
        clusterRef: 'platform:llm-cluster',
        addonName: 'vpc-cni',
        addonVersion: 'v1.14.1-eksbuild.1',
        resolveConflicts: 'OVERWRITE',
      },
    },
  });

  const modelRegistry = createTestNode({
    id: 'platform:model-registry',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-ecr',
        imageTagMutability: 'IMMUTABLE',
        scanOnPush: true,
      },
    },
  });

  const modelWeights = createTestNode({
    id: 'platform:model-weights',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-s3',
        versioning: true,
      },
    },
  });

  const encryptionKey = createTestNode({
    id: 'platform:encryption-key',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-kms',
        enableKeyRotation: true,
      },
    },
  });

  const inferenceEndpoint = createTestNode({
    id: 'platform:inference-endpoint',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-alb',
        internal: false,
        subnets: ['platform:llm-subnet-1', 'platform:llm-subnet-2'],
        securityGroups: ['platform:llm-sg'],
      },
    },
  });

  const gpuBindsWeights = createTestEdge({
    id: 'edge:bindsTo:platform:gpu-nodes:platform:model-weights',
    type: 'bindsTo',
    source: gpuNodes.id,
    target: modelWeights.id,
    metadata: {
      bindingConfig: {
        resourceType: 'bucket',
        accessLevel: 'read',
      },
    },
  });

  return [
    { type: 'addNode', node: llmVpc },
    { type: 'addNode', node: llmSubnet1 },
    { type: 'addNode', node: llmSubnet2 },
    { type: 'addNode', node: llmSg },
    { type: 'addNode', node: llmCluster },
    { type: 'addNode', node: gpuNodes },
    { type: 'addNode', node: vpcCniAddon },
    { type: 'addNode', node: modelRegistry },
    { type: 'addNode', node: modelWeights },
    { type: 'addNode', node: encryptionKey },
    { type: 'addNode', node: inferenceEndpoint },
    { type: 'addEdge', edge: gpuBindsWeights },
  ];
}

function makeBinders() {
  const registry = new BinderRegistry();
  registry.register(new ComponentPlatformBinder());
  registry.register(new TriggersBinder());
  return registry.getBinders();
}

describe('Golden: Blueprint BP-A02 — Self-Hosted LLM on EKS', () => {
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

  it('contains all 11 nodes', () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: 'Baseline' },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    expect(compilation.snapshot.nodes).toHaveLength(11);
    const ids = compilation.snapshot.nodes.map((n) => n.id);
    expect(ids).toContain('platform:llm-vpc');
    expect(ids).toContain('platform:llm-subnet-1');
    expect(ids).toContain('platform:llm-subnet-2');
    expect(ids).toContain('platform:llm-sg');
    expect(ids).toContain('platform:llm-cluster');
    expect(ids).toContain('platform:gpu-nodes');
    expect(ids).toContain('platform:vpc-cni-addon');
    expect(ids).toContain('platform:model-registry');
    expect(ids).toContain('platform:model-weights');
    expect(ids).toContain('platform:encryption-key');
    expect(ids).toContain('platform:inference-endpoint');
  });

  it('contains 1 edge (gpu-nodes→model-weights)', () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: 'Baseline' },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    expect(compilation.snapshot.edges).toHaveLength(1);
  });

  it('emits zero intents (platform-to-platform edges do not produce intents)', () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: 'Baseline' },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    expect(compilation.intents).toHaveLength(0);
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

    it('eks-gpu-spot-capacity does not fire (ON_DEMAND by default)', () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: 'Baseline' },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const violations = compilation.policy?.violations.filter(
        (v) => v.ruleId === 'eks-gpu-spot-capacity',
      );
      expect(violations).toHaveLength(0);
    });

    it('eks-addon-version-unset does not fire (version pinned)', () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: 'Baseline' },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const violations = compilation.policy?.violations.filter(
        (v) => v.ruleId === 'eks-addon-version-unset',
      );
      expect(violations).toHaveLength(0);
    });

    it('alb-access-logs-disabled fires (access logs not configured)', () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: 'Baseline' },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const violations = compilation.policy?.violations.filter(
        (v) => v.ruleId === 'alb-access-logs-disabled',
      );
      expect(violations?.length).toBeGreaterThanOrEqual(1);
    });
  });
});
