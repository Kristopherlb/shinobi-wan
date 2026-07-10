import { describe, it, expect } from 'vitest';
import { ElastiCacheLowerer } from '../lowerers/elasticache-lowerer';
import { makeNode, makeDefaultContext, makeDefaultDeps } from './test-helpers';

const DEFAULT_CONTEXT = makeDefaultContext({
  adapterConfig: { region: 'us-east-1', serviceName: 'my-service' },
});
const DEFAULT_DEPS = makeDefaultDeps();

describe('ElastiCacheLowerer', () => {
  const lowerer = new ElastiCacheLowerer();

  it('has correct platform', () => {
    expect(lowerer.platform).toBe('aws-elasticache');
  });

  it('produces SubnetGroup + ReplicationGroup resources', () => {
    const node = makeNode({
      id: 'platform:cache',
      type: 'platform',
      metadata: { properties: { platform: 'aws-elasticache' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources).toHaveLength(2);
    expect(resources[0].resourceType).toBe('aws:elasticache:SubnetGroup');
    expect(resources[1].resourceType).toBe('aws:elasticache:ReplicationGroup');
  });

  it('uses correct naming convention', () => {
    const node = makeNode({
      id: 'platform:session-cache',
      type: 'platform',
      metadata: { properties: { platform: 'aws-elasticache' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].name).toBe('session-cache-redis-subnet-group');
    expect(resources[1].name).toBe('session-cache-redis');
  });

  it('sets correct tags', () => {
    const node = makeNode({
      id: 'platform:cache',
      type: 'platform',
      metadata: { properties: { platform: 'aws-elasticache' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = resources[1].properties['tags'] as Record<string, string>;
    expect(tags['shinobi:node']).toBe('platform:cache');
    expect(tags['shinobi:platform']).toBe('aws-elasticache');
  });

  it('uses default values', () => {
    const node = makeNode({
      id: 'platform:cache',
      type: 'platform',
      metadata: { properties: { platform: 'aws-elasticache' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const redis = resources[1];
    expect(redis.properties['nodeType']).toBe('cache.t3.micro');
    expect(redis.properties['numCacheClusters']).toBe(2);
    expect(redis.properties['transitEncryptionEnabled']).toBe(true);
    expect(redis.properties['atRestEncryptionEnabled']).toBe(true);
    expect(redis.properties['port']).toBe(6379);
  });

  it('respects custom config', () => {
    const node = makeNode({
      id: 'platform:cache',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-elasticache',
          nodeType: 'cache.r6g.large',
          numCacheClusters: 3,
          port: 6380,
          transitEncryptionEnabled: false,
          atRestEncryptionEnabled: false,
        },
      },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const redis = resources[1];
    expect(redis.properties['nodeType']).toBe('cache.r6g.large');
    expect(redis.properties['numCacheClusters']).toBe(3);
    expect(redis.properties['port']).toBe(6380);
    expect(redis.properties['transitEncryptionEnabled']).toBe(false);
    expect(redis.properties['atRestEncryptionEnabled']).toBe(false);
  });

  it('includes authToken when provided', () => {
    const node = makeNode({
      id: 'platform:cache',
      type: 'platform',
      metadata: {
        properties: { platform: 'aws-elasticache', authToken: 'super-secret' },
      },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[1].properties['authToken']).toBe('super-secret');
  });

  it('does not include authToken when not provided', () => {
    const node = makeNode({
      id: 'platform:cache',
      type: 'platform',
      metadata: { properties: { platform: 'aws-elasticache' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[1].properties['authToken']).toBeUndefined();
  });

  it('replication group depends on subnet group', () => {
    const node = makeNode({
      id: 'platform:cache',
      type: 'platform',
      metadata: { properties: { platform: 'aws-elasticache' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[1].dependsOn).toContain('cache-redis-subnet-group');
  });

  it('sets sourceId to node ID', () => {
    const node = makeNode({
      id: 'platform:cache',
      type: 'platform',
      metadata: { properties: { platform: 'aws-elasticache' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    for (const r of resources) {
      expect(r.sourceId).toBe('platform:cache');
    }
  });

  it('output is deterministic', () => {
    const node = makeNode({
      id: 'platform:cache',
      type: 'platform',
      metadata: { properties: { platform: 'aws-elasticache' } },
    });

    const r1 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const r2 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it('passes custom tags', () => {
    const node = makeNode({
      id: 'platform:cache',
      type: 'platform',
      metadata: {
        properties: { platform: 'aws-elasticache', tags: { env: 'prod' } },
      },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = resources[1].properties['tags'] as Record<string, string>;
    expect(tags['env']).toBe('prod');
  });
});
