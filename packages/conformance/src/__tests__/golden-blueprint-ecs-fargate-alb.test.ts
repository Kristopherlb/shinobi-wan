import { describe, it, expect } from 'vitest';
import { createTestNode, createTestEdge } from '@shinobi/ir';
import type { GraphMutation } from '@shinobi/ir';
import { ComponentPlatformBinder, TriggersBinder, BinderRegistry } from '@shinobi/binder';
import { BaselinePolicyEvaluator } from '@shinobi/policy';
import { runGoldenCase } from '../golden-runner';

/**
 * Golden test for Blueprint BP-006: ECS Fargate + ALB
 *
 * Architecture:
 *   VPC + 2 Subnets + 2 Security Groups
 *   ECR → ECS Cluster → ECS Task Definition → ECS Service → ALB
 *
 * This is a platform-only blueprint — all nodes are platform type.
 * Platform-to-platform bindsTo edges produce zero intents because
 * ComponentPlatformBinder only fires for component→platform edges.
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

  const subnet1a = createTestNode({
    id: 'platform:subnet-1a',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-subnet',
        vpcId: 'platform:app-vpc',
        cidrBlock: '10.0.1.0/24',
        availabilityZone: 'us-east-1a',
        mapPublicIpOnLaunch: true,
      },
    },
  });

  const subnet1b = createTestNode({
    id: 'platform:subnet-1b',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-subnet',
        vpcId: 'platform:app-vpc',
        cidrBlock: '10.0.2.0/24',
        availabilityZone: 'us-east-1b',
        mapPublicIpOnLaunch: true,
      },
    },
  });

  const albSg = createTestNode({
    id: 'platform:alb-sg',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-security-group',
        vpcId: 'platform:app-vpc',
        description: 'ALB security group — public HTTPS',
        ingressRules: [
          { protocol: 'tcp', fromPort: 443, toPort: 443, cidrBlocks: ['0.0.0.0/0'] },
          { protocol: 'tcp', fromPort: 80, toPort: 80, cidrBlocks: ['0.0.0.0/0'] },
        ],
      },
    },
  });

  const ecsSg = createTestNode({
    id: 'platform:ecs-sg',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-security-group',
        vpcId: 'platform:app-vpc',
        description: 'ECS tasks — ALB ingress only',
      },
    },
  });

  const appRepo = createTestNode({
    id: 'platform:app-repo',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-ecr',
        scanOnPush: true,
      },
    },
  });

  const appCluster = createTestNode({
    id: 'platform:app-cluster',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-ecs-cluster',
        containerInsights: true,
      },
    },
  });

  const appTask = createTestNode({
    id: 'platform:app-task',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-ecs-task-definition',
        cpu: '256',
        memory: '512',
        containerDefinitions: [
          {
            name: 'app',
            image: 'ecs-fargate-alb-app-task:latest',
            cpu: 256,
            memory: 512,
            portMappings: [{ containerPort: 3000, protocol: 'tcp' }],
          },
        ],
      },
    },
  });

  const appService = createTestNode({
    id: 'platform:app-service',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-ecs-service',
        cluster: 'platform:app-cluster',
        taskDefinition: 'platform:app-task',
        desiredCount: 2,
        subnets: ['platform:subnet-1a', 'platform:subnet-1b'],
        securityGroups: ['platform:ecs-sg'],
        assignPublicIp: false,
      },
    },
  });

  const appAlb = createTestNode({
    id: 'platform:app-alb',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-alb',
        vpcId: 'platform:app-vpc',
        subnets: ['platform:subnet-1a', 'platform:subnet-1b'],
        securityGroups: ['platform:alb-sg'],
        healthCheck: {
          path: '/health',
          interval: 30,
          timeout: 5,
          healthyThreshold: 2,
          unhealthyThreshold: 3,
        },
      },
    },
  });

  const serviceBindsAlb = createTestEdge({
    id: 'edge:bindsTo:platform:app-service:platform:app-alb',
    type: 'bindsTo',
    source: appService.id,
    target: appAlb.id,
    metadata: {
      bindingConfig: {
        resourceType: 'loadbalancer',
        accessLevel: 'read',
        network: { port: 443, protocol: 'tcp' },
      },
    },
  });

  return [
    { type: 'addNode', node: appVpc },
    { type: 'addNode', node: subnet1a },
    { type: 'addNode', node: subnet1b },
    { type: 'addNode', node: albSg },
    { type: 'addNode', node: ecsSg },
    { type: 'addNode', node: appRepo },
    { type: 'addNode', node: appCluster },
    { type: 'addNode', node: appTask },
    { type: 'addNode', node: appService },
    { type: 'addNode', node: appAlb },
    { type: 'addEdge', edge: serviceBindsAlb },
  ];
}

function makeBinders() {
  const registry = new BinderRegistry();
  registry.register(new ComponentPlatformBinder());
  registry.register(new TriggersBinder());
  return registry.getBinders();
}

describe('Golden: Blueprint BP-006 — ECS Fargate + ALB', () => {
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

  it('contains all 10 nodes', () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: 'Baseline' },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    expect(compilation.snapshot.nodes).toHaveLength(10);
    const ids = compilation.snapshot.nodes.map((n) => n.id);
    expect(ids).toContain('platform:app-vpc');
    expect(ids).toContain('platform:subnet-1a');
    expect(ids).toContain('platform:subnet-1b');
    expect(ids).toContain('platform:alb-sg');
    expect(ids).toContain('platform:ecs-sg');
    expect(ids).toContain('platform:app-repo');
    expect(ids).toContain('platform:app-cluster');
    expect(ids).toContain('platform:app-task');
    expect(ids).toContain('platform:app-service');
    expect(ids).toContain('platform:app-alb');
  });

  it('contains 1 edge (service→alb)', () => {
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

    // Platform-to-platform bindsTo edges are not handled by ComponentPlatformBinder
    // (which only fires for component→platform edges). Infrastructure relationships
    // are resolved at lowerer time, not binder time.
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

    it('ecs-task-public-ip does not fire when assignPublicIp is false', () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: 'Baseline' },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const violations = compilation.policy?.violations.filter(
        (v) => v.ruleId === 'ecs-task-public-ip',
      );
      expect(violations).toHaveLength(0);
    });

    it('ecr-image-scan-disabled does not fire when scanOnPush is true', () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: 'Baseline' },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const violations = compilation.policy?.violations.filter(
        (v) => v.ruleId === 'ecr-image-scan-disabled',
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

    it('FedRAMP-High escalates alb-access-logs-disabled to error', () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: 'FedRAMP-High' },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const violations = compilation.policy?.violations.filter(
        (v) => v.ruleId === 'alb-access-logs-disabled',
      );
      for (const v of violations ?? []) {
        expect(v.severity).toBe('error');
      }
    });
  });
});
