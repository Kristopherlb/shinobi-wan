import { describe, it, expect } from 'vitest';
import { createTestNode, createTestEdge } from '@shinobi/ir';
import type { GraphMutation } from '@shinobi/ir';
import { ComponentPlatformBinder, TriggersBinder, BinderRegistry } from '@shinobi/binder';
import { BaselinePolicyEvaluator } from '@shinobi/policy';
import { runGoldenCase } from '../golden-runner';

/**
 * Golden test for Blueprint BP-I10: MSK Kafka
 *
 * Architecture:
 *   VPC + 3 Subnets + SG + KMS
 *   MSK Configuration + MSK Cluster
 *   S3 (logs)
 *
 * Platform-only blueprint — 1 edge for log delivery produces zero intents.
 *
 * Gates: determinism (G-001), compilation (G-002), policy evaluation
 */

function setupBlueprint(): ReadonlyArray<GraphMutation> {
  const mskVpc = createTestNode({
    id: 'platform:msk-vpc', type: 'platform',
    metadata: { properties: { platform: 'aws-vpc', cidrBlock: '10.0.0.0/16' } },
  });
  const subnet1 = createTestNode({
    id: 'platform:msk-subnet-1', type: 'platform',
    metadata: { properties: { platform: 'aws-subnet', vpcId: 'platform:msk-vpc', cidrBlock: '10.0.1.0/24', availabilityZone: 'us-east-1a', mapPublicIpOnLaunch: false } },
  });
  const subnet2 = createTestNode({
    id: 'platform:msk-subnet-2', type: 'platform',
    metadata: { properties: { platform: 'aws-subnet', vpcId: 'platform:msk-vpc', cidrBlock: '10.0.2.0/24', availabilityZone: 'us-east-1b', mapPublicIpOnLaunch: false } },
  });
  const subnet3 = createTestNode({
    id: 'platform:msk-subnet-3', type: 'platform',
    metadata: { properties: { platform: 'aws-subnet', vpcId: 'platform:msk-vpc', cidrBlock: '10.0.3.0/24', availabilityZone: 'us-east-1c', mapPublicIpOnLaunch: false } },
  });
  const mskSg = createTestNode({
    id: 'platform:msk-sg', type: 'platform',
    metadata: { properties: { platform: 'aws-security-group', vpcId: 'platform:msk-vpc', description: 'MSK SG' } },
  });
  const mskKey = createTestNode({
    id: 'platform:msk-key', type: 'platform',
    metadata: { properties: { platform: 'aws-kms', description: 'MSK key', enableKeyRotation: true } },
  });
  const mskConfig = createTestNode({
    id: 'platform:msk-config', type: 'platform',
    metadata: { properties: { platform: 'aws-msk-configuration', serverProperties: 'auto.create.topics.enable=false' } },
  });
  const mskCluster = createTestNode({
    id: 'platform:msk-cluster', type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-msk-cluster',
        kafkaVersion: '3.5.1',
        numberOfBrokerNodes: 3,
        encryptionInTransit: 'TLS',
        clientAuthentication: { sasl: { iam: true } },
        subnetIds: ['platform:msk-subnet-1', 'platform:msk-subnet-2', 'platform:msk-subnet-3'],
        securityGroupIds: ['platform:msk-sg'],
      },
    },
  });
  const mskLogs = createTestNode({
    id: 'platform:msk-logs', type: 'platform',
    metadata: { properties: { platform: 'aws-s3', versioning: true } },
  });

  const clusterWritesLogs = createTestEdge({
    id: 'edge:bindsTo:platform:msk-cluster:platform:msk-logs',
    type: 'bindsTo',
    source: mskCluster.id,
    target: mskLogs.id,
    metadata: { bindingConfig: { resourceType: 'bucket', accessLevel: 'write' } },
  });

  return [
    { type: 'addNode', node: mskVpc },
    { type: 'addNode', node: subnet1 },
    { type: 'addNode', node: subnet2 },
    { type: 'addNode', node: subnet3 },
    { type: 'addNode', node: mskSg },
    { type: 'addNode', node: mskKey },
    { type: 'addNode', node: mskConfig },
    { type: 'addNode', node: mskCluster },
    { type: 'addNode', node: mskLogs },
    { type: 'addEdge', edge: clusterWritesLogs },
  ];
}

function makeBinders() {
  const registry = new BinderRegistry();
  registry.register(new ComponentPlatformBinder());
  registry.register(new TriggersBinder());
  return registry.getBinders();
}

describe('Golden: Blueprint BP-I10 — MSK Kafka', () => {
  const evaluator = new BaselinePolicyEvaluator();

  it('compiles successfully', () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint, config: { policyPack: 'Baseline' }, binders: makeBinders(), evaluators: [evaluator],
    });
    expect(compilation.validation.valid).toBe(true);
  });

  it('contains all 9 nodes', () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint, config: { policyPack: 'Baseline' }, binders: makeBinders(), evaluators: [evaluator],
    });
    expect(compilation.snapshot.nodes).toHaveLength(9);
  });

  it('contains 1 edge', () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint, config: { policyPack: 'Baseline' }, binders: makeBinders(), evaluators: [evaluator],
    });
    expect(compilation.snapshot.edges).toHaveLength(1);
  });

  it('emits zero intents (platform-to-platform)', () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint, config: { policyPack: 'Baseline' }, binders: makeBinders(), evaluators: [evaluator],
    });
    expect(compilation.intents).toHaveLength(0);
  });

  it('determinism: identical output across two runs', () => {
    const opts = { setup: setupBlueprint, config: { policyPack: 'Baseline' }, binders: makeBinders(), evaluators: [evaluator] };
    const r1 = runGoldenCase(opts);
    const r2 = runGoldenCase(opts);
    expect(r1.serialized).toBe(r2.serialized);
  });

  describe('policy evaluation across packs', () => {
    it.each(['Baseline', 'FedRAMP-Moderate', 'FedRAMP-High'] as const)(
      'evaluates with pack %s without throwing', (pack) => {
        const { compilation } = runGoldenCase({
          setup: setupBlueprint, config: { policyPack: pack }, binders: makeBinders(), evaluators: [evaluator],
        });
        expect(compilation.policy?.violations).toBeDefined();
      },
    );

    it('msk-encryption-in-transit-disabled does not fire (TLS set)', () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint, config: { policyPack: 'Baseline' }, binders: makeBinders(), evaluators: [evaluator],
      });
      expect(compilation.policy?.violations.filter((v) => v.ruleId === 'msk-encryption-in-transit-disabled')).toHaveLength(0);
    });

    it('msk-authentication-disabled does not fire (SASL-IAM set)', () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint, config: { policyPack: 'Baseline' }, binders: makeBinders(), evaluators: [evaluator],
      });
      expect(compilation.policy?.violations.filter((v) => v.ruleId === 'msk-authentication-disabled')).toHaveLength(0);
    });
  });
});
