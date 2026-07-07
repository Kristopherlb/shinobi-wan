import { describe, it, expect } from 'vitest';
import { createTestNode, createTestEdge } from '@shinobi/ir';
import type { GraphMutation } from '@shinobi/ir';
import {
  ComponentPlatformBinder,
  TriggersBinder,
  BinderRegistry,
} from '@shinobi/binder';
import { BaselinePolicyEvaluator } from '@shinobi/policy';
import { runGoldenCase } from '../golden-runner';

/**
 * Golden test for Blueprint BP-I15: WAF + Shield + Secrets
 *
 * Architecture:
 *   KMS Key → SecretsManager Secret (encrypted, rotating)
 *   WAF Web ACL → CloudFront Distribution → S3 Origin
 *   ACM Certificate for HTTPS
 *
 * Platform-only blueprint — all nodes are platform type.
 * Platform-to-platform bindsTo edges produce zero intents.
 *
 * Gates: determinism (G-001), compilation (G-002), policy evaluation
 */

function setupBlueprint(): ReadonlyArray<GraphMutation> {
  const encryptionKey = createTestNode({
    id: 'platform:encryption-key',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-kms',
        keySpec: 'SYMMETRIC_DEFAULT',
        enableKeyRotation: true,
        deletionWindowInDays: 30,
      },
    },
  });

  const appSecret = createTestNode({
    id: 'platform:app-secret',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-secretsmanager',
        kmsKeyId: 'platform:encryption-key',
        rotationEnabled: true,
        rotationDays: 30,
      },
    },
  });

  const webAcl = createTestNode({
    id: 'platform:web-acl',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-wafv2',
        scope: 'CLOUDFRONT',
        defaultAction: 'allow',
        managedRules: [
          { name: 'AWSManagedRulesCommonRuleSet', priority: 1 },
          { name: 'AWSManagedRulesKnownBadInputsRuleSet', priority: 2 },
        ],
      },
    },
  });

  const sslCert = createTestNode({
    id: 'platform:ssl-cert',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-acm',
        domainName: 'waf-shield-secrets.example.com',
        validationMethod: 'DNS',
      },
    },
  });

  const cdn = createTestNode({
    id: 'platform:cdn',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-cloudfront',
        wafAclArn: 'platform:web-acl',
        certificateArn: 'platform:ssl-cert',
        minimumProtocolVersion: 'TLSv1.2_2021',
      },
    },
  });

  const originBucket = createTestNode({
    id: 'platform:origin-bucket',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-s3',
        versioning: true,
      },
    },
  });

  const cdnToOrigin = createTestEdge({
    id: 'edge:bindsTo:platform:cdn:platform:origin-bucket',
    type: 'bindsTo',
    source: cdn.id,
    target: originBucket.id,
    metadata: {
      bindingConfig: {
        resourceType: 'bucket',
        accessLevel: 'read',
      },
    },
  });

  const secretToKey = createTestEdge({
    id: 'edge:bindsTo:platform:app-secret:platform:encryption-key',
    type: 'bindsTo',
    source: appSecret.id,
    target: encryptionKey.id,
    metadata: {
      bindingConfig: {
        resourceType: 'key',
        accessLevel: 'write',
      },
    },
  });

  return [
    { type: 'addNode', node: encryptionKey },
    { type: 'addNode', node: appSecret },
    { type: 'addNode', node: webAcl },
    { type: 'addNode', node: sslCert },
    { type: 'addNode', node: cdn },
    { type: 'addNode', node: originBucket },
    { type: 'addEdge', edge: cdnToOrigin },
    { type: 'addEdge', edge: secretToKey },
  ];
}

function makeBinders() {
  const registry = new BinderRegistry();
  registry.register(new ComponentPlatformBinder());
  registry.register(new TriggersBinder());
  return registry.getBinders();
}

describe('Golden: Blueprint BP-I15 — WAF + Shield + Secrets', () => {
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

  it('contains all 6 nodes', () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: 'Baseline' },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    expect(compilation.snapshot.nodes).toHaveLength(6);
    const ids = compilation.snapshot.nodes.map((n) => n.id);
    expect(ids).toContain('platform:encryption-key');
    expect(ids).toContain('platform:app-secret');
    expect(ids).toContain('platform:web-acl');
    expect(ids).toContain('platform:ssl-cert');
    expect(ids).toContain('platform:cdn');
    expect(ids).toContain('platform:origin-bucket');
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

  it('emits zero intents (platform-to-platform edges)', () => {
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

    it('secrets-rotation-disabled does not fire (rotation enabled)', () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: 'Baseline' },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const violations = compilation.policy?.violations.filter(
        (v) => v.ruleId === 'secrets-rotation-disabled',
      );
      expect(violations).toHaveLength(0);
    });

    it('kms-key-rotation-disabled does not fire (rotation enabled)', () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: 'Baseline' },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const violations = compilation.policy?.violations.filter(
        (v) => v.ruleId === 'kms-key-rotation-disabled',
      );
      expect(violations).toHaveLength(0);
    });

    it('FedRAMP-High escalates kms-key-rotation-disabled to error', () => {
      const noRotationKey = createTestNode({
        id: 'platform:insecure-key',
        type: 'platform',
        metadata: {
          properties: {
            platform: 'aws-kms',
            keySpec: 'SYMMETRIC_DEFAULT',
            enableKeyRotation: false,
          },
        },
      });

      const mutations: ReadonlyArray<GraphMutation> = [
        { type: 'addNode', node: noRotationKey },
      ];

      const { compilation } = runGoldenCase({
        setup: () => mutations,
        config: { policyPack: 'FedRAMP-High' },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const violations = compilation.policy?.violations.filter(
        (v) => v.ruleId === 'kms-key-rotation-disabled',
      );
      expect(violations?.length).toBeGreaterThanOrEqual(1);
      for (const v of violations ?? []) {
        expect(v.severity).toBe('error');
      }
    });
  });
});
