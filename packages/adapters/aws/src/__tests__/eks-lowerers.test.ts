import { describe, it, expect } from 'vitest';
import { createTestNode } from '@shinobi/ir';
import { makeDefaultContext, makeDefaultDeps } from './test-helpers';
import { EksClusterLowerer } from '../lowerers/eks-cluster-lowerer';
import { EksNodeGroupLowerer } from '../lowerers/eks-node-group-lowerer';

const DEFAULT_CONTEXT = makeDefaultContext();
const DEFAULT_DEPS = makeDefaultDeps();

describe('EksClusterLowerer', () => {
  const lowerer = new EksClusterLowerer();

  it('should lower EKS cluster node to 2 resources (cluster + log group)', () => {
    const node = createTestNode({
      id: 'platform:my-cluster',
      type: 'platform',
      metadata: { properties: { platform: 'aws-eks-cluster' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result).toHaveLength(2);
  });

  it('should emit correct resource types', () => {
    const node = createTestNode({
      id: 'platform:my-cluster',
      type: 'platform',
      metadata: { properties: { platform: 'aws-eks-cluster' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.resourceType).toBe('aws:eks:Cluster');
    expect(result[1]?.resourceType).toBe('aws:cloudwatch:LogGroup');
  });

  it('should follow naming pattern with shortName', () => {
    const node = createTestNode({
      id: 'platform:my-cluster',
      type: 'platform',
      metadata: { properties: { platform: 'aws-eks-cluster' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.name).toBe('my-cluster-cluster');
    expect(result[1]?.name).toBe('my-cluster-cluster-log-group');
  });

  it('should use default Kubernetes version 1.29', () => {
    const node = createTestNode({
      id: 'platform:my-cluster',
      type: 'platform',
      metadata: { properties: { platform: 'aws-eks-cluster' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.version).toBe('1.29');
  });

  it('should respect custom Kubernetes version', () => {
    const node = createTestNode({
      id: 'platform:my-cluster',
      type: 'platform',
      metadata: {
        properties: { platform: 'aws-eks-cluster', version: '1.28' },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.version).toBe('1.28');
  });

  it('should resolve subnet refs', () => {
    const node = createTestNode({
      id: 'platform:my-cluster',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-eks-cluster',
          subnetIds: ['platform:subnet-1a', 'platform:subnet-1b'],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    const vpcConfig = result[0]?.properties?.vpcConfig as Record<
      string,
      unknown
    >;
    expect(vpcConfig?.subnetIds).toEqual([
      { ref: 'subnet-1a-subnet' },
      { ref: 'subnet-1b-subnet' },
    ]);
  });

  it('should resolve security group refs', () => {
    const node = createTestNode({
      id: 'platform:my-cluster',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-eks-cluster',
          securityGroupIds: ['platform:cluster-sg'],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    const vpcConfig = result[0]?.properties?.vpcConfig as Record<
      string,
      unknown
    >;
    expect(vpcConfig?.securityGroupIds).toEqual([{ ref: 'cluster-sg-sg' }]);
  });

  it('should default to private endpoint only', () => {
    const node = createTestNode({
      id: 'platform:my-cluster',
      type: 'platform',
      metadata: { properties: { platform: 'aws-eks-cluster' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    const vpcConfig = result[0]?.properties?.vpcConfig as Record<
      string,
      unknown
    >;
    expect(vpcConfig?.endpointPrivateAccess).toBe(true);
    expect(vpcConfig?.endpointPublicAccess).toBe(false);
  });

  it('should respect custom endpoint configuration', () => {
    const node = createTestNode({
      id: 'platform:my-cluster',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-eks-cluster',
          endpointPrivateAccess: false,
          endpointPublicAccess: true,
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    const vpcConfig = result[0]?.properties?.vpcConfig as Record<
      string,
      unknown
    >;
    expect(vpcConfig?.endpointPrivateAccess).toBe(false);
    expect(vpcConfig?.endpointPublicAccess).toBe(true);
  });

  it('should default to api, audit, authenticator log types', () => {
    const node = createTestNode({
      id: 'platform:my-cluster',
      type: 'platform',
      metadata: { properties: { platform: 'aws-eks-cluster' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.enabledClusterLogTypes).toEqual([
      'api',
      'audit',
      'authenticator',
    ]);
  });

  it('should respect custom log types', () => {
    const node = createTestNode({
      id: 'platform:my-cluster',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-eks-cluster',
          enabledClusterLogTypes: ['api'],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.enabledClusterLogTypes).toEqual(['api']);
  });

  it('should include standard tags', () => {
    const node = createTestNode({
      id: 'platform:my-cluster',
      type: 'platform',
      metadata: { properties: { platform: 'aws-eks-cluster' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.tags).toEqual(
      expect.objectContaining({
        'shinobi:node': 'platform:my-cluster',
        'shinobi:platform': 'aws-eks-cluster',
      }),
    );
  });

  it('should include custom tags', () => {
    const node = createTestNode({
      id: 'platform:my-cluster',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-eks-cluster',
          tags: { env: 'prod' },
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.tags).toEqual(
      expect.objectContaining({ env: 'prod' }),
    );
  });

  it('should include optional roleArn', () => {
    const node = createTestNode({
      id: 'platform:my-cluster',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-eks-cluster',
          roleArn: { ref: 'my-cluster-exec-role' },
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.roleArn).toEqual({
      ref: 'my-cluster-exec-role',
    });
  });

  it('determinism: identical output across two runs', () => {
    const node = createTestNode({
      id: 'platform:my-cluster',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-eks-cluster',
          subnetIds: ['platform:subnet-1a', 'platform:subnet-1b'],
          securityGroupIds: ['platform:cluster-sg'],
        },
      },
    });

    const r1 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const r2 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});

describe('EksNodeGroupLowerer', () => {
  const lowerer = new EksNodeGroupLowerer();

  it('should lower EKS node group to 1 resource', () => {
    const node = createTestNode({
      id: 'platform:my-nodes',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-eks-node-group',
          clusterName: 'platform:my-cluster',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result).toHaveLength(1);
  });

  it('should emit correct resource type', () => {
    const node = createTestNode({
      id: 'platform:my-nodes',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-eks-node-group',
          clusterName: 'platform:my-cluster',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.resourceType).toBe('aws:eks:NodeGroup');
  });

  it('should follow naming pattern with shortName', () => {
    const node = createTestNode({
      id: 'platform:my-nodes',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-eks-node-group',
          clusterName: 'platform:my-cluster',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.name).toBe('my-nodes-node-group');
  });

  it('should resolve cluster name ref', () => {
    const node = createTestNode({
      id: 'platform:my-nodes',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-eks-node-group',
          clusterName: 'platform:my-cluster',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.clusterName).toEqual({
      ref: 'my-cluster-cluster.name',
    });
  });

  it('should resolve subnet refs', () => {
    const node = createTestNode({
      id: 'platform:my-nodes',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-eks-node-group',
          clusterName: 'platform:my-cluster',
          subnetIds: ['platform:subnet-1a', 'platform:subnet-1b'],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.subnetIds).toEqual([
      { ref: 'subnet-1a-subnet' },
      { ref: 'subnet-1b-subnet' },
    ]);
  });

  it('should default to t3.medium instance type', () => {
    const node = createTestNode({
      id: 'platform:my-nodes',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-eks-node-group',
          clusterName: 'platform:my-cluster',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.instanceTypes).toEqual(['t3.medium']);
  });

  it('should respect custom instance types', () => {
    const node = createTestNode({
      id: 'platform:my-nodes',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-eks-node-group',
          clusterName: 'platform:my-cluster',
          instanceTypes: ['m5.large', 'm5.xlarge'],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.instanceTypes).toEqual([
      'm5.large',
      'm5.xlarge',
    ]);
  });

  it('should use default scaling config', () => {
    const node = createTestNode({
      id: 'platform:my-nodes',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-eks-node-group',
          clusterName: 'platform:my-cluster',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.scalingConfig).toEqual({
      desiredSize: 2,
      minSize: 1,
      maxSize: 4,
    });
  });

  it('should respect custom scaling config', () => {
    const node = createTestNode({
      id: 'platform:my-nodes',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-eks-node-group',
          clusterName: 'platform:my-cluster',
          scalingConfig: { desiredSize: 3, minSize: 2, maxSize: 6 },
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.scalingConfig).toEqual({
      desiredSize: 3,
      minSize: 2,
      maxSize: 6,
    });
  });

  it('should default to AL2_x86_64 AMI type', () => {
    const node = createTestNode({
      id: 'platform:my-nodes',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-eks-node-group',
          clusterName: 'platform:my-cluster',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.amiType).toBe('AL2_x86_64');
  });

  it('should default to 20 GB disk size', () => {
    const node = createTestNode({
      id: 'platform:my-nodes',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-eks-node-group',
          clusterName: 'platform:my-cluster',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.diskSize).toBe(20);
  });

  it('should include standard tags', () => {
    const node = createTestNode({
      id: 'platform:my-nodes',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-eks-node-group',
          clusterName: 'platform:my-cluster',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.tags).toEqual(
      expect.objectContaining({
        'shinobi:node': 'platform:my-nodes',
        'shinobi:platform': 'aws-eks-node-group',
      }),
    );
  });

  it('should include optional nodeRoleArn', () => {
    const node = createTestNode({
      id: 'platform:my-nodes',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-eks-node-group',
          clusterName: 'platform:my-cluster',
          nodeRoleArn: { ref: 'my-nodes-exec-role' },
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.nodeRoleArn).toEqual({
      ref: 'my-nodes-exec-role',
    });
  });

  it('determinism: identical output across two runs', () => {
    const node = createTestNode({
      id: 'platform:my-nodes',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-eks-node-group',
          clusterName: 'platform:my-cluster',
          subnetIds: ['platform:subnet-1a'],
        },
      },
    });

    const r1 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const r2 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});
