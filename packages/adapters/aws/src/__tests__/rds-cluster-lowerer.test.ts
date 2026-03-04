import { describe, it, expect } from 'vitest';
import { RdsClusterLowerer } from '../lowerers/rds-cluster-lowerer';
import { makeNode, makeDefaultContext, makeDefaultDeps } from './test-helpers';

const DEFAULT_CONTEXT = makeDefaultContext({ adapterConfig: { region: 'us-east-1', serviceName: 'my-service' } });
const DEFAULT_DEPS = makeDefaultDeps();

describe('RdsClusterLowerer', () => {
  const lowerer = new RdsClusterLowerer();

  it('has correct platform', () => {
    expect(lowerer.platform).toBe('aws-rds-cluster');
  });

  it('produces Cluster + ClusterInstance (no subnet group when no subnets)', () => {
    const node = makeNode({
      id: 'platform:db-cluster',
      type: 'platform',
      metadata: { properties: { platform: 'aws-rds-cluster', storageEncrypted: true } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources).toHaveLength(2);
    expect(resources[0].resourceType).toBe('aws:rds:Cluster');
    expect(resources[1].resourceType).toBe('aws:rds:ClusterInstance');
  });

  it('produces SubnetGroup + Cluster + ClusterInstance when subnets provided', () => {
    const node = makeNode({
      id: 'platform:db-cluster',
      type: 'platform',
      metadata: { properties: { platform: 'aws-rds-cluster', subnetIds: ['subnet-1', 'subnet-2'] } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources).toHaveLength(3);
    expect(resources[0].resourceType).toBe('aws:rds:SubnetGroup');
    expect(resources[1].resourceType).toBe('aws:rds:Cluster');
    expect(resources[2].resourceType).toBe('aws:rds:ClusterInstance');
  });

  it('uses correct naming convention', () => {
    const node = makeNode({
      id: 'platform:db-cluster',
      type: 'platform',
      metadata: { properties: { platform: 'aws-rds-cluster' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].name).toBe('db-cluster-rds-cluster');
    expect(resources[1].name).toBe('db-cluster-rds-instance');
    expect(resources[0].properties['clusterIdentifier']).toBe('my-service-db-cluster');
  });

  it('sets correct tags', () => {
    const node = makeNode({
      id: 'platform:db-cluster',
      type: 'platform',
      metadata: { properties: { platform: 'aws-rds-cluster' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = resources[0].properties['tags'] as Record<string, string>;
    expect(tags['shinobi:node']).toBe('platform:db-cluster');
    expect(tags['shinobi:platform']).toBe('aws-rds-cluster');
  });

  it('applies default config values', () => {
    const node = makeNode({
      id: 'platform:db-cluster',
      type: 'platform',
      metadata: { properties: { platform: 'aws-rds-cluster' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const cluster = resources[0].properties;
    expect(cluster['engine']).toBe('aurora-postgresql');
    expect(cluster['engineVersion']).toBe('15.4');
    expect(cluster['masterUsername']).toBe('admin');
    expect(cluster['backupRetentionPeriod']).toBe(7);
  });

  it('configures serverless v2 scaling by default', () => {
    const node = makeNode({
      id: 'platform:db-cluster',
      type: 'platform',
      metadata: { properties: { platform: 'aws-rds-cluster' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const scaling = resources[0].properties['serverlessv2ScalingConfiguration'] as Record<string, unknown>;
    expect(scaling['minCapacity']).toBe(0.5);
    expect(scaling['maxCapacity']).toBe(16);
  });

  it('instance depends on cluster', () => {
    const node = makeNode({
      id: 'platform:db-cluster',
      type: 'platform',
      metadata: { properties: { platform: 'aws-rds-cluster' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[1].dependsOn).toContain('db-cluster-rds-cluster');
    expect(resources[1].properties['clusterIdentifier']).toEqual({ ref: 'db-cluster-rds-cluster' });
  });

  it('cluster depends on subnet group when provided', () => {
    const node = makeNode({
      id: 'platform:db-cluster',
      type: 'platform',
      metadata: { properties: { platform: 'aws-rds-cluster', subnetIds: ['subnet-1'] } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[1].dependsOn).toContain('db-cluster-rds-subnet-group');
  });

  it('sets sourceId to node ID', () => {
    const node = makeNode({
      id: 'platform:db-cluster',
      type: 'platform',
      metadata: { properties: { platform: 'aws-rds-cluster' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    for (const r of resources) {
      expect(r.sourceId).toBe('platform:db-cluster');
    }
  });

  it('output is deterministic', () => {
    const node = makeNode({
      id: 'platform:db-cluster',
      type: 'platform',
      metadata: { properties: { platform: 'aws-rds-cluster' } },
    });

    const r1 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const r2 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it('passes custom tags', () => {
    const node = makeNode({
      id: 'platform:db-cluster',
      type: 'platform',
      metadata: { properties: { platform: 'aws-rds-cluster', tags: { env: 'prod' } } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = resources[0].properties['tags'] as Record<string, string>;
    expect(tags['env']).toBe('prod');
  });
});
