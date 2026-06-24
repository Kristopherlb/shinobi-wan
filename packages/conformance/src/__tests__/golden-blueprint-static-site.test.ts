import { describe, it, expect } from 'vitest';
import { createTestNode, createTestEdge } from '@shinobi/ir';
import type { GraphMutation } from '@shinobi/ir';
import { ComponentPlatformBinder, TriggersBinder, BinderRegistry } from '@shinobi/binder';
import { BaselinePolicyEvaluator } from '@shinobi/policy';
import { runGoldenCase } from '../golden-runner';

/**
 * Golden test for Blueprint BP-008: Static Site + CDN + WAF
 *
 * Architecture:
 *   S3 (private, OAC) → CloudFront (TLSv1.2_2021) → WAF v2 (managed rules)
 *   ACM cert for custom domain, CloudFront Function for URL rewriting
 *
 * Gates: determinism (G-001), compilation (G-002), policy evaluation
 */

function setupBlueprint(): ReadonlyArray<GraphMutation> {
  const siteAssets = createTestNode({
    id: 'platform:site-assets',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-s3',
        versioning: true,
      },
    },
  });

  const siteCert = createTestNode({
    id: 'platform:site-cert',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-acm',
        domainName: 'static-site-cdn-waf.example.com',
      },
    },
  });

  const siteWaf = createTestNode({
    id: 'platform:site-waf',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-wafv2',
        scope: 'CLOUDFRONT',
      },
    },
  });

  const cdn = createTestNode({
    id: 'platform:cdn',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-cloudfront',
        minimumProtocolVersion: 'TLSv1.2_2021',
        aliases: ['static-site-cdn-waf.example.com'],
        certificateDomain: 'static-site-cdn-waf.example.com',
        wafAclArn: 'attached', // WAF is attached — waf-not-attached should not fire
      },
    },
  });

  const urlRewriter = createTestNode({
    id: 'platform:url-rewriter',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-cloudfront-function',
        runtime: 'cloudfront-js-2.0',
      },
    },
  });

  const cdnBindsAssets = createTestEdge({
    id: 'edge:bindsTo:platform:cdn:platform:site-assets',
    type: 'bindsTo',
    source: cdn.id,
    target: siteAssets.id,
    metadata: {
      bindingConfig: {
        resourceType: 'bucket',
        accessLevel: 'read',
        network: { port: 443, protocol: 'tcp' },
        configKeys: [
          { key: 'ORIGIN_BUCKET', valueSource: { type: 'reference', nodeRef: 'site-assets', field: 'bucket' } },
        ],
      },
    },
  });

  const wafBindsCdn = createTestEdge({
    id: 'edge:bindsTo:platform:site-waf:platform:cdn',
    type: 'bindsTo',
    source: siteWaf.id,
    target: cdn.id,
    metadata: {
      bindingConfig: {
        resourceType: 'distribution',
        accessLevel: 'write',
        network: { port: 443, protocol: 'tcp' },
        configKeys: [
          { key: 'DISTRIBUTION_ARN', valueSource: { type: 'reference', nodeRef: 'cdn', field: 'arn' } },
        ],
      },
    },
  });

  return [
    { type: 'addNode', node: siteAssets },
    { type: 'addNode', node: siteCert },
    { type: 'addNode', node: siteWaf },
    { type: 'addNode', node: cdn },
    { type: 'addNode', node: urlRewriter },
    { type: 'addEdge', edge: cdnBindsAssets },
    { type: 'addEdge', edge: wafBindsCdn },
  ];
}

function makeBinders() {
  const registry = new BinderRegistry();
  registry.register(new ComponentPlatformBinder());
  registry.register(new TriggersBinder());
  return registry.getBinders();
}

describe('Golden: Blueprint BP-008 — Static Site + CDN + WAF', () => {
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
    expect(ids).toContain('platform:site-assets');
    expect(ids).toContain('platform:site-cert');
    expect(ids).toContain('platform:site-waf');
    expect(ids).toContain('platform:cdn');
    expect(ids).toContain('platform:url-rewriter');
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

  it('emits no intents (platform-to-platform edges are not compiled by ComponentPlatformBinder)', () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: 'Baseline' },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    // BP-008 has only platform→platform edges — no component nodes,
    // so ComponentPlatformBinder doesn't fire. Intents come from lowerers instead.
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

    it('cloudfront-ssl-protocol-weak does not fire with TLSv1.2_2021', () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: 'Baseline' },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const sslViolations = compilation.policy?.violations.filter(
        (v) => v.ruleId === 'cloudfront-ssl-protocol-weak',
      );
      expect(sslViolations).toHaveLength(0);
    });

    it('waf-not-attached does not fire when wafAclArn is set', () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: 'Baseline' },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const wafViolations = compilation.policy?.violations.filter(
        (v) => v.ruleId === 'waf-not-attached',
      );
      expect(wafViolations).toHaveLength(0);
    });

    it('s3-public-access-not-blocked does not fire without publicAccess', () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: 'Baseline' },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const publicViolations = compilation.policy?.violations.filter(
        (v) => v.ruleId === 's3-public-access-not-blocked',
      );
      expect(publicViolations).toHaveLength(0);
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
