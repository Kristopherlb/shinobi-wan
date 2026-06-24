import { describe, it, expect } from 'vitest';
import { createTestNode } from '@shinobi/ir';
import { makeDefaultContext, makeDefaultDeps } from './test-helpers';
import { MskClusterLowerer } from '../lowerers/msk-cluster-lowerer';
import { MskConfigurationLowerer } from '../lowerers/msk-configuration-lowerer';

const DEFAULT_CONTEXT = makeDefaultContext();
const DEFAULT_DEPS = makeDefaultDeps();

describe('MskClusterLowerer', () => {
  const lowerer = new MskClusterLowerer();

  it('should emit 2 resources (log group + cluster)', () => {
    const node = createTestNode({
      id: 'platform:msk-cluster',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-msk-cluster',
          subnetIds: ['platform:subnet-1', 'platform:subnet-2'],
          securityGroupIds: ['platform:msk-sg'],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result).toHaveLength(2);
    expect(result[0]?.resourceType).toBe('aws:cloudwatch:LogGroup');
    expect(result[1]?.resourceType).toBe('aws:msk:Cluster');
  });

  it('should follow naming pattern', () => {
    const node = createTestNode({
      id: 'platform:msk-cluster',
      type: 'platform',
      metadata: { properties: { platform: 'aws-msk-cluster' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.name).toBe('msk-cluster-msk-log-group');
    expect(result[1]?.name).toBe('msk-cluster-msk-cluster');
  });

  it('should use default kafka version 3.5.1', () => {
    const node = createTestNode({
      id: 'platform:cluster',
      type: 'platform',
      metadata: { properties: { platform: 'aws-msk-cluster' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[1]?.properties?.kafkaVersion).toBe('3.5.1');
  });

  it('should default to 3 broker nodes', () => {
    const node = createTestNode({
      id: 'platform:cluster',
      type: 'platform',
      metadata: { properties: { platform: 'aws-msk-cluster' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[1]?.properties?.numberOfBrokerNodes).toBe(3);
  });

  it('should resolve subnet refs', () => {
    const node = createTestNode({
      id: 'platform:cluster',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-msk-cluster',
          subnetIds: ['platform:subnet-1', 'platform:subnet-2', 'platform:subnet-3'],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const brokerInfo = result[1]?.properties?.brokerNodeGroupInfo as Record<string, unknown>;
    expect(brokerInfo?.clientSubnets).toEqual([
      { ref: 'subnet-1-subnet' },
      { ref: 'subnet-2-subnet' },
      { ref: 'subnet-3-subnet' },
    ]);
  });

  it('should include client authentication when provided', () => {
    const node = createTestNode({
      id: 'platform:cluster',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-msk-cluster',
          clientAuthentication: { sasl: { iam: true } },
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[1]?.properties?.clientAuthentication).toEqual({ sasl: { iam: true } });
  });

  it('should default to TLS encryption in transit', () => {
    const node = createTestNode({
      id: 'platform:cluster',
      type: 'platform',
      metadata: { properties: { platform: 'aws-msk-cluster' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const encryptionInfo = result[1]?.properties?.encryptionInfo as Record<string, unknown>;
    const inTransit = encryptionInfo?.encryptionInTransit as Record<string, unknown>;
    expect(inTransit?.clientBroker).toBe('TLS');
  });

  it('should include standard tags', () => {
    const node = createTestNode({
      id: 'platform:cluster',
      type: 'platform',
      metadata: { properties: { platform: 'aws-msk-cluster' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = result[1]?.properties?.tags as Record<string, string>;
    expect(tags?.['shinobi:platform']).toBe('aws-msk-cluster');
  });

  it('cluster should depend on log group', () => {
    const node = createTestNode({
      id: 'platform:cluster',
      type: 'platform',
      metadata: { properties: { platform: 'aws-msk-cluster' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[1]?.dependsOn).toContain('cluster-msk-log-group');
  });
});

describe('MskConfigurationLowerer', () => {
  const lowerer = new MskConfigurationLowerer();

  it('should emit 1 resource (configuration)', () => {
    const node = createTestNode({
      id: 'platform:msk-config',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-msk-configuration',
          serverProperties: 'auto.create.topics.enable=false\nlog.retention.hours=168',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result).toHaveLength(1);
    expect(result[0]?.resourceType).toBe('aws:msk:Configuration');
    expect(result[0]?.name).toBe('msk-config-msk-config');
  });

  it('should default kafka versions to [3.5.1]', () => {
    const node = createTestNode({
      id: 'platform:config',
      type: 'platform',
      metadata: { properties: { platform: 'aws-msk-configuration', serverProperties: '' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.kafkaVersions).toEqual(['3.5.1']);
  });

  it('should pass through server properties', () => {
    const serverProps = 'auto.create.topics.enable=false\nlog.retention.hours=168';
    const node = createTestNode({
      id: 'platform:config',
      type: 'platform',
      metadata: { properties: { platform: 'aws-msk-configuration', serverProperties: serverProps } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.serverProperties).toBe(serverProps);
  });

  it('should include standard tags', () => {
    const node = createTestNode({
      id: 'platform:config',
      type: 'platform',
      metadata: { properties: { platform: 'aws-msk-configuration', serverProperties: '' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = result[0]?.properties?.tags as Record<string, string>;
    expect(tags?.['shinobi:platform']).toBe('aws-msk-configuration');
  });
});
