import { describe, it, expect } from 'vitest';
import { createTestNode, createTestEdge } from '@shinobi/ir';
import type { GraphMutation } from '@shinobi/ir';
import { ComponentPlatformBinder, TriggersBinder, BinderRegistry } from '@shinobi/binder';
import { BaselinePolicyEvaluator } from '@shinobi/policy';
import { runGoldenCase } from '../golden-runner';

/**
 * Golden test for Blueprint BP-I12: ElastiCache Redis
 *
 * Architecture:
 *   VPC + Subnet + Security Group
 *   ElastiCache Redis ReplicationGroup (encrypted, AUTH)
 *   Lambda consumer with VPC access
 *
 * Mixed blueprint: platform nodes + 1 component node.
 * Component→platform bindsTo produces IAM + network + config intents.
 *
 * Gates: determinism (G-001), compilation (G-002), policy evaluation
 */

function setupBlueprint(): ReadonlyArray<GraphMutation> {
  const appVpc = createTestNode({
    id: 'platform:app-vpc',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-vpc',
        cidrBlock: '10.0.0.0/16',
      },
    },
  });

  const cacheSubnet = createTestNode({
    id: 'platform:cache-subnet',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-subnet',
        vpcId: 'platform:app-vpc',
        cidrBlock: '10.0.10.0/24',
        availabilityZone: 'us-east-1a',
      },
    },
  });

  const cacheSg = createTestNode({
    id: 'platform:cache-sg',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-security-group',
        vpcId: 'platform:app-vpc',
        description: 'ElastiCache Redis security group',
      },
    },
  });

  const redis = createTestNode({
    id: 'platform:redis',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-elasticache',
        nodeType: 'cache.t3.micro',
        numCacheClusters: 2,
        transitEncryptionEnabled: true,
        atRestEncryptionEnabled: true,
        authToken: 'test-auth-token',
        port: 6379,
        subnetIds: ['platform:cache-subnet'],
        securityGroupIds: ['platform:cache-sg'],
      },
    },
  });

  const cacheReader = createTestNode({
    id: 'component:cache-reader',
    type: 'component',
    metadata: {
      properties: {
        platform: 'aws-lambda',
        runtime: 'nodejs20.x',
        handler: 'index.handler',
        memorySize: 256,
        timeout: 30,
        tracing: true,
      },
    },
  });

  const readerToRedis = createTestEdge({
    id: 'edge:bindsTo:component:cache-reader:platform:redis',
    type: 'bindsTo',
    source: cacheReader.id,
    target: redis.id,
    metadata: {
      bindingConfig: {
        resourceType: 'redis',
        accessLevel: 'read',
        network: { port: 6379, protocol: 'tcp' },
        configKeys: [
          { key: 'REDIS_ENDPOINT', valueSource: { type: 'reference', nodeRef: 'redis', field: 'primaryEndpointAddress' } },
        ],
      },
    },
  });

  return [
    { type: 'addNode', node: appVpc },
    { type: 'addNode', node: cacheSubnet },
    { type: 'addNode', node: cacheSg },
    { type: 'addNode', node: redis },
    { type: 'addNode', node: cacheReader },
    { type: 'addEdge', edge: readerToRedis },
  ];
}

function makeBinders() {
  const registry = new BinderRegistry();
  registry.register(new ComponentPlatformBinder());
  registry.register(new TriggersBinder());
  return registry.getBinders();
}

describe('Golden: Blueprint BP-I12 — ElastiCache Redis', () => {
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
    expect(ids).toContain('platform:cache-subnet');
    expect(ids).toContain('platform:cache-sg');
    expect(ids).toContain('platform:redis');
    expect(ids).toContain('component:cache-reader');
  });

  it('contains 1 edge', () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: 'Baseline' },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    expect(compilation.snapshot.edges).toHaveLength(1);
  });

  it('emits intents (component→platform edge)', () => {
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

    it('elasticache-encryption-disabled does not fire (encryption enabled)', () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: 'Baseline' },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const violations = compilation.policy?.violations.filter(
        (v) => v.ruleId === 'elasticache-encryption-disabled',
      );
      expect(violations).toHaveLength(0);
    });

    it('elasticache-auth-disabled does not fire (auth token set)', () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: 'Baseline' },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const violations = compilation.policy?.violations.filter(
        (v) => v.ruleId === 'elasticache-auth-disabled',
      );
      expect(violations).toHaveLength(0);
    });
  });
});
