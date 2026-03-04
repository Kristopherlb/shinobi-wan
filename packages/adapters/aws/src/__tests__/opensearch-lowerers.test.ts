import { describe, it, expect } from 'vitest';
import { OpenSearchDomainLowerer } from '../lowerers/opensearch-domain-lowerer';
import { OpenSearchServerlessLowerer } from '../lowerers/opensearch-serverless-lowerer';
import { makeNode, makeDefaultContext, makeDefaultDeps } from './test-helpers';

const DEFAULT_CONTEXT = makeDefaultContext({ adapterConfig: { region: 'us-east-1', serviceName: 'my-service' } });
const DEFAULT_DEPS = makeDefaultDeps();

describe('OpenSearchDomainLowerer', () => {
  const lowerer = new OpenSearchDomainLowerer();

  it('has correct platform', () => {
    expect(lowerer.platform).toBe('aws-opensearch');
  });

  it('produces Domain + LogGroup resources', () => {
    const node = makeNode({
      id: 'platform:search',
      type: 'platform',
      metadata: { properties: { platform: 'aws-opensearch', encryptionAtRest: true, nodeToNodeEncryption: true } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources).toHaveLength(2);
    expect(resources[0].resourceType).toBe('aws:cloudwatch:LogGroup');
    expect(resources[1].resourceType).toBe('aws:opensearch:Domain');
  });

  it('uses correct naming convention', () => {
    const node = makeNode({
      id: 'platform:search',
      type: 'platform',
      metadata: { properties: { platform: 'aws-opensearch' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].name).toBe('search-domain-log-group');
    expect(resources[1].name).toBe('search-domain');
    expect(resources[1].properties['domainName']).toBe('my-service-search');
  });

  it('sets correct tags', () => {
    const node = makeNode({
      id: 'platform:search',
      type: 'platform',
      metadata: { properties: { platform: 'aws-opensearch' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = resources[1].properties['tags'] as Record<string, string>;
    expect(tags['shinobi:node']).toBe('platform:search');
    expect(tags['shinobi:platform']).toBe('aws-opensearch');
  });

  it('applies default config values', () => {
    const node = makeNode({
      id: 'platform:search',
      type: 'platform',
      metadata: { properties: { platform: 'aws-opensearch' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const domain = resources[1].properties;
    expect(domain['engineVersion']).toBe('OpenSearch_2.11');
    const cluster = domain['clusterConfig'] as Record<string, unknown>;
    expect(cluster['instanceType']).toBe('t3.small.search');
    expect(cluster['instanceCount']).toBe(2);
  });

  it('respects custom config values', () => {
    const node = makeNode({
      id: 'platform:search',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-opensearch',
          engineVersion: 'OpenSearch_2.9',
          instanceType: 'r6g.large.search',
          instanceCount: 3,
          volumeSize: 100,
        },
      },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const domain = resources[1].properties;
    expect(domain['engineVersion']).toBe('OpenSearch_2.9');
    const cluster = domain['clusterConfig'] as Record<string, unknown>;
    expect(cluster['instanceType']).toBe('r6g.large.search');
    expect(cluster['instanceCount']).toBe(3);
  });

  it('sets encryption options from config', () => {
    const node = makeNode({
      id: 'platform:search',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-opensearch',
          encryptionAtRest: true,
          nodeToNodeEncryption: true,
        },
      },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const domain = resources[1].properties;
    const ear = domain['encryptAtRestOptions'] as Record<string, unknown>;
    expect(ear['enabled']).toBe(true);
    const n2n = domain['nodeToNodeEncryptionOptions'] as Record<string, unknown>;
    expect(n2n['enabled']).toBe(true);
  });

  it('domain depends on log group', () => {
    const node = makeNode({
      id: 'platform:search',
      type: 'platform',
      metadata: { properties: { platform: 'aws-opensearch' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[1].dependsOn).toContain('search-domain-log-group');
  });

  it('sets sourceId to node ID', () => {
    const node = makeNode({
      id: 'platform:search',
      type: 'platform',
      metadata: { properties: { platform: 'aws-opensearch' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    for (const r of resources) {
      expect(r.sourceId).toBe('platform:search');
    }
  });

  it('output is deterministic', () => {
    const node = makeNode({
      id: 'platform:search',
      type: 'platform',
      metadata: { properties: { platform: 'aws-opensearch' } },
    });

    const r1 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const r2 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it('passes custom tags', () => {
    const node = makeNode({
      id: 'platform:search',
      type: 'platform',
      metadata: { properties: { platform: 'aws-opensearch', tags: { env: 'prod' } } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = resources[1].properties['tags'] as Record<string, string>;
    expect(tags['env']).toBe('prod');
  });

  it('adds VPC options when not public', () => {
    const node = makeNode({
      id: 'platform:search',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-opensearch',
          publicAccess: false,
          subnetIds: ['subnet-1'],
          securityGroupIds: ['sg-1'],
        },
      },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const domain = resources[1].properties;
    const vpcOptions = domain['vpcOptions'] as Record<string, unknown>;
    expect(vpcOptions['subnetIds']).toEqual(['subnet-1']);
    expect(vpcOptions['securityGroupIds']).toEqual(['sg-1']);
  });
});

describe('OpenSearchServerlessLowerer', () => {
  const lowerer = new OpenSearchServerlessLowerer();

  it('has correct platform', () => {
    expect(lowerer.platform).toBe('aws-opensearch-serverless');
  });

  it('produces SecurityPolicy + AccessPolicy + Collection resources', () => {
    const node = makeNode({
      id: 'platform:vectors',
      type: 'platform',
      metadata: { properties: { platform: 'aws-opensearch-serverless' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources).toHaveLength(3);
    expect(resources[0].resourceType).toBe('aws:opensearchserverless:SecurityPolicy');
    expect(resources[1].resourceType).toBe('aws:opensearchserverless:AccessPolicy');
    expect(resources[2].resourceType).toBe('aws:opensearchserverless:Collection');
  });

  it('uses correct naming convention', () => {
    const node = makeNode({
      id: 'platform:vectors',
      type: 'platform',
      metadata: { properties: { platform: 'aws-opensearch-serverless' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].name).toBe('vectors-collection-security-policy');
    expect(resources[1].name).toBe('vectors-collection-access-policy');
    expect(resources[2].name).toBe('vectors-collection');
  });

  it('collection depends on policies', () => {
    const node = makeNode({
      id: 'platform:vectors',
      type: 'platform',
      metadata: { properties: { platform: 'aws-opensearch-serverless' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[2].dependsOn).toContain('vectors-collection-security-policy');
    expect(resources[2].dependsOn).toContain('vectors-collection-access-policy');
  });

  it('defaults to VECTORSEARCH type', () => {
    const node = makeNode({
      id: 'platform:vectors',
      type: 'platform',
      metadata: { properties: { platform: 'aws-opensearch-serverless' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[2].properties['type']).toBe('VECTORSEARCH');
  });

  it('sets sourceId to node ID', () => {
    const node = makeNode({
      id: 'platform:vectors',
      type: 'platform',
      metadata: { properties: { platform: 'aws-opensearch-serverless' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    for (const r of resources) {
      expect(r.sourceId).toBe('platform:vectors');
    }
  });

  it('output is deterministic', () => {
    const node = makeNode({
      id: 'platform:vectors',
      type: 'platform',
      metadata: { properties: { platform: 'aws-opensearch-serverless' } },
    });

    const r1 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const r2 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it('passes custom tags', () => {
    const node = makeNode({
      id: 'platform:vectors',
      type: 'platform',
      metadata: { properties: { platform: 'aws-opensearch-serverless', tags: { env: 'staging' } } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = resources[2].properties['tags'] as Record<string, string>;
    expect(tags['env']).toBe('staging');
  });

  it('uses custom KMS key', () => {
    const node = makeNode({
      id: 'platform:vectors',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-opensearch-serverless',
          kmsKeyArn: { ref: 'encryption-key-key.arn' },
        },
      },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const policy = JSON.parse(resources[0].properties['policy'] as string);
    expect(policy['AWSOwnedKey']).toBe(false);
  });
});
