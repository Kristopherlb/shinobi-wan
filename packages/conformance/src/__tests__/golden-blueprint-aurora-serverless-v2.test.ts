import { describe, it, expect } from 'vitest';
import { createTestNode, createTestEdge } from '@shinobi/ir';
import type { GraphMutation } from '@shinobi/ir';
import { ComponentPlatformBinder, TriggersBinder, BinderRegistry } from '@shinobi/binder';
import { BaselinePolicyEvaluator } from '@shinobi/policy';
import { runGoldenCase } from '../golden-runner';

/**
 * Golden test for Blueprint BP-I09: Aurora Serverless v2
 *
 * Architecture:
 *   VPC + 2 Subnets + Security Group
 *   Aurora Serverless v2 Cluster (encrypted)
 *   RDS Proxy for connection pooling
 *   SecretsManager + KMS
 *
 * Platform-only blueprint — bindsTo edges between platform nodes
 * produce zero intents.
 *
 * Gates: determinism (G-001), compilation (G-002), policy evaluation
 */

function setupBlueprint(): ReadonlyArray<GraphMutation> {
  const appVpc = createTestNode({
    id: 'platform:app-vpc',
    type: 'platform',
    metadata: { properties: { platform: 'aws-vpc', cidrBlock: '10.0.0.0/16' } },
  });

  const dbSubnet1 = createTestNode({
    id: 'platform:db-subnet-1',
    type: 'platform',
    metadata: { properties: { platform: 'aws-subnet', vpcId: 'platform:app-vpc', cidrBlock: '10.0.10.0/24', availabilityZone: 'us-east-1a' } },
  });

  const dbSubnet2 = createTestNode({
    id: 'platform:db-subnet-2',
    type: 'platform',
    metadata: { properties: { platform: 'aws-subnet', vpcId: 'platform:app-vpc', cidrBlock: '10.0.11.0/24', availabilityZone: 'us-east-1b' } },
  });

  const dbSg = createTestNode({
    id: 'platform:db-sg',
    type: 'platform',
    metadata: { properties: { platform: 'aws-security-group', vpcId: 'platform:app-vpc', description: 'Aurora Serverless v2 security group' } },
  });

  const dbKey = createTestNode({
    id: 'platform:db-key',
    type: 'platform',
    metadata: { properties: { platform: 'aws-kms', enableKeyRotation: true } },
  });

  const dbSecret = createTestNode({
    id: 'platform:db-secret',
    type: 'platform',
    metadata: { properties: { platform: 'aws-secretsmanager', rotationEnabled: true, rotationDays: 30 } },
  });

  const dbCluster = createTestNode({
    id: 'platform:db-cluster',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-rds-cluster',
        engine: 'aurora-postgresql',
        engineVersion: '15.4',
        masterUsername: 'admin',
        storageEncrypted: true,
        deletionProtection: true,
        backupRetentionPeriod: 7,
        publicAccess: false,
        instanceClass: 'db.serverless',
        serverlessMinCapacity: 0.5,
        serverlessMaxCapacity: 16,
        subnetIds: ['platform:db-subnet-1', 'platform:db-subnet-2'],
        securityGroupIds: ['platform:db-sg'],
      },
    },
  });

  const dbProxy = createTestNode({
    id: 'platform:db-proxy',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-rds-proxy',
        engineFamily: 'POSTGRESQL',
        clusterRef: 'platform:db-cluster',
        secretArn: 'platform:db-secret',
        requireTls: true,
        idleClientTimeout: 1800,
        subnetIds: ['platform:db-subnet-1', 'platform:db-subnet-2'],
        securityGroupIds: ['platform:db-sg'],
      },
    },
  });

  const proxyToCluster = createTestEdge({
    id: 'edge:bindsTo:platform:db-proxy:platform:db-cluster',
    type: 'bindsTo',
    source: dbProxy.id,
    target: dbCluster.id,
    metadata: {
      bindingConfig: {
        resourceType: 'rds-cluster',
        accessLevel: 'write',
      },
    },
  });

  const proxyToSecret = createTestEdge({
    id: 'edge:bindsTo:platform:db-proxy:platform:db-secret',
    type: 'bindsTo',
    source: dbProxy.id,
    target: dbSecret.id,
    metadata: {
      bindingConfig: {
        resourceType: 'secret',
        accessLevel: 'read',
      },
    },
  });

  return [
    { type: 'addNode', node: appVpc },
    { type: 'addNode', node: dbSubnet1 },
    { type: 'addNode', node: dbSubnet2 },
    { type: 'addNode', node: dbSg },
    { type: 'addNode', node: dbKey },
    { type: 'addNode', node: dbSecret },
    { type: 'addNode', node: dbCluster },
    { type: 'addNode', node: dbProxy },
    { type: 'addEdge', edge: proxyToCluster },
    { type: 'addEdge', edge: proxyToSecret },
  ];
}

function makeBinders() {
  const registry = new BinderRegistry();
  registry.register(new ComponentPlatformBinder());
  registry.register(new TriggersBinder());
  return registry.getBinders();
}

describe('Golden: Blueprint BP-I09 — Aurora Serverless v2', () => {
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

  it('contains all 8 nodes', () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: 'Baseline' },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    expect(compilation.snapshot.nodes).toHaveLength(8);
    const ids = compilation.snapshot.nodes.map((n) => n.id);
    expect(ids).toContain('platform:app-vpc');
    expect(ids).toContain('platform:db-subnet-1');
    expect(ids).toContain('platform:db-subnet-2');
    expect(ids).toContain('platform:db-sg');
    expect(ids).toContain('platform:db-key');
    expect(ids).toContain('platform:db-secret');
    expect(ids).toContain('platform:db-cluster');
    expect(ids).toContain('platform:db-proxy');
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

  it('emits zero intents (platform-only edges)', () => {
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

    it('rds-encryption-disabled does not fire (storageEncrypted=true)', () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: 'Baseline' },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const violations = compilation.policy?.violations.filter(
        (v) => v.ruleId === 'rds-encryption-disabled',
      );
      expect(violations).toHaveLength(0);
    });

    it('rds-public-access does not fire (publicAccess=false)', () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: 'Baseline' },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const violations = compilation.policy?.violations.filter(
        (v) => v.ruleId === 'rds-public-access',
      );
      expect(violations).toHaveLength(0);
    });
  });
});
