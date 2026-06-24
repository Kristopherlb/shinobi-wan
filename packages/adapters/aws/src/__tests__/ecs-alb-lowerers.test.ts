import { describe, it, expect } from 'vitest';
import { createTestNode } from '@shinobi/ir';
import { makeDefaultContext, makeDefaultDeps } from './test-helpers';
import { VpcLowerer } from '../lowerers/vpc-lowerer';
import { SubnetLowerer } from '../lowerers/subnet-lowerer';
import { SecurityGroupLowerer } from '../lowerers/security-group-lowerer';
import { EcrLowerer } from '../lowerers/ecr-lowerer';
import { EcsClusterLowerer } from '../lowerers/ecs-cluster-lowerer';
import { EcsTaskDefinitionLowerer } from '../lowerers/ecs-task-definition-lowerer';
import { EcsServiceLowerer } from '../lowerers/ecs-service-lowerer';
import { AlbLowerer } from '../lowerers/alb-lowerer';

const DEFAULT_CONTEXT = makeDefaultContext();
const DEFAULT_DEPS = makeDefaultDeps();

describe('VpcLowerer', () => {
  const lowerer = new VpcLowerer();

  it('should lower VPC node to 3 resources (vpc, igw, igw-attachment)', () => {
    const node = createTestNode({
      id: 'platform:my-vpc',
      type: 'platform',
      metadata: { properties: { platform: 'aws-vpc' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result).toHaveLength(3);
  });

  it('should emit correct resource types', () => {
    const node = createTestNode({
      id: 'platform:my-vpc',
      type: 'platform',
      metadata: { properties: { platform: 'aws-vpc' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.resourceType).toBe('aws:ec2:Vpc');
    expect(result[1]?.resourceType).toBe('aws:ec2:InternetGateway');
    expect(result[2]?.resourceType).toBe('aws:ec2:InternetGatewayAttachment');
  });

  it('should follow naming pattern with shortName', () => {
    const node = createTestNode({
      id: 'platform:my-vpc',
      type: 'platform',
      metadata: { properties: { platform: 'aws-vpc' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.name).toBe('my-vpc-vpc');
    expect(result[1]?.name).toBe('my-vpc-igw');
    expect(result[2]?.name).toBe('my-vpc-igw-attachment');
  });

  it('should use default CIDR block', () => {
    const node = createTestNode({
      id: 'platform:my-vpc',
      type: 'platform',
      metadata: { properties: { platform: 'aws-vpc' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.cidrBlock).toBe('10.0.0.0/16');
  });

  it('should respect custom CIDR block', () => {
    const node = createTestNode({
      id: 'platform:my-vpc',
      type: 'platform',
      metadata: { properties: { platform: 'aws-vpc', cidrBlock: '172.16.0.0/12' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.cidrBlock).toBe('172.16.0.0/12');
  });

  it('should enable DNS hostnames by default', () => {
    const node = createTestNode({
      id: 'platform:my-vpc',
      type: 'platform',
      metadata: { properties: { platform: 'aws-vpc' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.enableDnsHostnames).toBe(true);
    expect(result[0]?.properties?.enableDnsSupport).toBe(true);
  });

  it('should set IGW attachment dependency on VPC and IGW', () => {
    const node = createTestNode({
      id: 'platform:my-vpc',
      type: 'platform',
      metadata: { properties: { platform: 'aws-vpc' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[2]?.dependsOn).toEqual(['my-vpc-vpc', 'my-vpc-igw']);
  });

  it('should attach VPC ref to IGW attachment properties', () => {
    const node = createTestNode({
      id: 'platform:my-vpc',
      type: 'platform',
      metadata: { properties: { platform: 'aws-vpc' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[2]?.properties?.vpcId).toEqual({ ref: 'my-vpc-vpc' });
    expect(result[2]?.properties?.internetGatewayId).toEqual({ ref: 'my-vpc-igw' });
  });

  it('should include standard tags', () => {
    const node = createTestNode({
      id: 'platform:my-vpc',
      type: 'platform',
      metadata: { properties: { platform: 'aws-vpc' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.tags).toEqual({
      'shinobi:node': 'platform:my-vpc',
      'shinobi:platform': 'aws-vpc',
    });
  });

  it('should be deterministic (run twice, same output)', () => {
    const node = createTestNode({
      id: 'platform:my-vpc',
      type: 'platform',
      metadata: { properties: { platform: 'aws-vpc' } },
    });

    const result1 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const result2 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result1).toEqual(result2);
  });

  it('should respect custom tags', () => {
    const node = createTestNode({
      id: 'platform:my-vpc',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-vpc',
          tags: { Environment: 'prod', Team: 'platform' },
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.tags).toEqual({
      'shinobi:node': 'platform:my-vpc',
      'shinobi:platform': 'aws-vpc',
      Environment: 'prod',
      Team: 'platform',
    });
  });

  it('should handle VPC with only required properties', () => {
    const node = createTestNode({
      id: 'platform:minimal-vpc',
      type: 'platform',
      metadata: { properties: { platform: 'aws-vpc' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result).toHaveLength(3);
    expect(result[0]?.properties?.cidrBlock).toBe('10.0.0.0/16');
  });

  it('should disable DNS features when configured', () => {
    const node = createTestNode({
      id: 'platform:my-vpc',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-vpc',
          enableDnsHostnames: false,
          enableDnsSupport: false,
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.enableDnsHostnames).toBe(false);
    expect(result[0]?.properties?.enableDnsSupport).toBe(false);
  });
});

describe('SubnetLowerer', () => {
  const lowerer = new SubnetLowerer();

  it('should lower Subnet node to 3 resources (subnet, rt, rt-assoc)', () => {
    const node = createTestNode({
      id: 'platform:my-subnet',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-subnet',
          vpcId: 'platform:my-vpc',
          cidrBlock: '10.0.1.0/24',
          availabilityZone: 'us-east-1a',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result).toHaveLength(3);
  });

  it('should emit correct resource types', () => {
    const node = createTestNode({
      id: 'platform:my-subnet',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-subnet',
          vpcId: 'platform:my-vpc',
          cidrBlock: '10.0.1.0/24',
          availabilityZone: 'us-east-1a',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.resourceType).toBe('aws:ec2:Subnet');
    expect(result[1]?.resourceType).toBe('aws:ec2:RouteTable');
    expect(result[2]?.resourceType).toBe('aws:ec2:RouteTableAssociation');
  });

  it('should follow naming pattern with shortName', () => {
    const node = createTestNode({
      id: 'platform:my-subnet',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-subnet',
          vpcId: 'platform:my-vpc',
          cidrBlock: '10.0.1.0/24',
          availabilityZone: 'us-east-1a',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.name).toBe('my-subnet-subnet');
    expect(result[1]?.name).toBe('my-subnet-rt');
    expect(result[2]?.name).toBe('my-subnet-rt-assoc');
  });

  it('should reference VPC ID from metadata', () => {
    const node = createTestNode({
      id: 'platform:my-subnet',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-subnet',
          vpcId: 'platform:my-vpc',
          cidrBlock: '10.0.1.0/24',
          availabilityZone: 'us-east-1a',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.vpcId).toEqual({ ref: 'my-vpc-vpc' });
    expect(result[1]?.properties?.vpcId).toEqual({ ref: 'my-vpc-vpc' });
  });

  it('should use provided CIDR block and AZ', () => {
    const node = createTestNode({
      id: 'platform:my-subnet',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-subnet',
          vpcId: 'platform:my-vpc',
          cidrBlock: '10.0.2.0/24',
          availabilityZone: 'us-east-1b',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.cidrBlock).toBe('10.0.2.0/24');
    expect(result[0]?.properties?.availabilityZone).toBe('us-east-1b');
  });

  it('should not map public IP by default', () => {
    const node = createTestNode({
      id: 'platform:my-subnet',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-subnet',
          vpcId: 'platform:my-vpc',
          cidrBlock: '10.0.1.0/24',
          availabilityZone: 'us-east-1a',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.mapPublicIpOnLaunch).toBe(false);
  });

  it('should enable public IP when configured', () => {
    const node = createTestNode({
      id: 'platform:my-subnet',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-subnet',
          vpcId: 'platform:my-vpc',
          cidrBlock: '10.0.1.0/24',
          availabilityZone: 'us-east-1a',
          mapPublicIpOnLaunch: true,
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.mapPublicIpOnLaunch).toBe(true);
  });

  it('should set route table association dependencies', () => {
    const node = createTestNode({
      id: 'platform:my-subnet',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-subnet',
          vpcId: 'platform:my-vpc',
          cidrBlock: '10.0.1.0/24',
          availabilityZone: 'us-east-1a',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[2]?.dependsOn).toEqual(['my-subnet-subnet', 'my-subnet-rt']);
  });

  it('should attach subnet and route table refs to association', () => {
    const node = createTestNode({
      id: 'platform:my-subnet',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-subnet',
          vpcId: 'platform:my-vpc',
          cidrBlock: '10.0.1.0/24',
          availabilityZone: 'us-east-1a',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[2]?.properties?.subnetId).toEqual({ ref: 'my-subnet-subnet' });
    expect(result[2]?.properties?.routeTableId).toEqual({ ref: 'my-subnet-rt' });
  });

  it('should include standard tags on all resources', () => {
    const node = createTestNode({
      id: 'platform:my-subnet',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-subnet',
          vpcId: 'platform:my-vpc',
          cidrBlock: '10.0.1.0/24',
          availabilityZone: 'us-east-1a',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.tags).toEqual({
      'shinobi:node': 'platform:my-subnet',
      'shinobi:platform': 'aws-subnet',
    });
    expect(result[1]?.properties?.tags).toEqual({
      'shinobi:node': 'platform:my-subnet',
      'shinobi:platform': 'aws-subnet',
    });
  });

  it('should be deterministic (run twice, same output)', () => {
    const node = createTestNode({
      id: 'platform:my-subnet',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-subnet',
          vpcId: 'platform:my-vpc',
          cidrBlock: '10.0.1.0/24',
          availabilityZone: 'us-east-1a',
        },
      },
    });

    const result1 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const result2 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result1).toEqual(result2);
  });

  it('should respect custom tags', () => {
    const node = createTestNode({
      id: 'platform:my-subnet',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-subnet',
          vpcId: 'platform:my-vpc',
          cidrBlock: '10.0.1.0/24',
          availabilityZone: 'us-east-1a',
          tags: { Tier: 'public' },
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.tags).toEqual({
      'shinobi:node': 'platform:my-subnet',
      'shinobi:platform': 'aws-subnet',
      Tier: 'public',
    });
  });

  it('should handle multiple subnets in different AZs', () => {
    const node1 = createTestNode({
      id: 'platform:subnet-1a',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-subnet',
          vpcId: 'platform:my-vpc',
          cidrBlock: '10.0.1.0/24',
          availabilityZone: 'us-east-1a',
        },
      },
    });

    const node2 = createTestNode({
      id: 'platform:subnet-1b',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-subnet',
          vpcId: 'platform:my-vpc',
          cidrBlock: '10.0.2.0/24',
          availabilityZone: 'us-east-1b',
        },
      },
    });

    const result1 = lowerer.lower(node1, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const result2 = lowerer.lower(node2, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result1[0]?.name).toBe('subnet-1a-subnet');
    expect(result2[0]?.name).toBe('subnet-1b-subnet');
    expect(result1[0]?.properties?.availabilityZone).toBe('us-east-1a');
    expect(result2[0]?.properties?.availabilityZone).toBe('us-east-1b');
  });
});

describe('SecurityGroupLowerer', () => {
  const lowerer = new SecurityGroupLowerer();

  it('should lower SecurityGroup node to at least 2 resources (sg + default egress)', () => {
    const node = createTestNode({
      id: 'platform:my-sg',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-security-group',
          vpcId: 'platform:my-vpc',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('should emit SecurityGroup and SecurityGroupRule resources', () => {
    const node = createTestNode({
      id: 'platform:my-sg',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-security-group',
          vpcId: 'platform:my-vpc',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.resourceType).toBe('aws:ec2:SecurityGroup');
    expect(result[1]?.resourceType).toBe('aws:ec2:SecurityGroupRule');
  });

  it('should follow naming pattern with shortName', () => {
    const node = createTestNode({
      id: 'platform:my-sg',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-security-group',
          vpcId: 'platform:my-vpc',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.name).toBe('my-sg-sg');
  });

  it('should reference VPC ID from metadata', () => {
    const node = createTestNode({
      id: 'platform:my-sg',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-security-group',
          vpcId: 'platform:my-vpc',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.vpcId).toEqual({ ref: 'my-vpc-vpc' });
  });

  it('should create default egress rule for all traffic', () => {
    const node = createTestNode({
      id: 'platform:my-sg',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-security-group',
          vpcId: 'platform:my-vpc',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    const egressRule = result.find((r) => r.name === 'my-sg-egress-all');
    expect(egressRule?.properties?.resourceType).toBe('egress');
    expect(egressRule?.properties?.protocol).toBe('-1');
    expect(egressRule?.properties?.fromPort).toBe(0);
    expect(egressRule?.properties?.toPort).toBe(0);
    expect(egressRule?.properties?.cidrBlocks).toEqual(['0.0.0.0/0']);
  });

  it('should create ingress rules from config', () => {
    const node = createTestNode({
      id: 'platform:my-sg',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-security-group',
          vpcId: 'platform:my-vpc',
          ingressRules: [
            {
              protocol: 'tcp',
              fromPort: 443,
              toPort: 443,
              cidrBlocks: ['0.0.0.0/0'],
            },
          ],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result.length).toBeGreaterThanOrEqual(3); // sg + ingress + egress
    const ingressRule = result.find((r) => r.name?.includes('ingress'));
    expect(ingressRule?.properties?.resourceType).toBe('ingress');
    expect(ingressRule?.properties?.protocol).toBe('tcp');
    expect(ingressRule?.properties?.fromPort).toBe(443);
  });

  it('should set rule dependencies on security group', () => {
    const node = createTestNode({
      id: 'platform:my-sg',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-security-group',
          vpcId: 'platform:my-vpc',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[1]?.dependsOn).toEqual(['my-sg-sg']);
  });

  it('should attach security group ref to rules', () => {
    const node = createTestNode({
      id: 'platform:my-sg',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-security-group',
          vpcId: 'platform:my-vpc',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[1]?.properties?.securityGroupId).toEqual({ ref: 'my-sg-sg' });
  });

  it('should include standard tags on security group', () => {
    const node = createTestNode({
      id: 'platform:my-sg',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-security-group',
          vpcId: 'platform:my-vpc',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.tags).toEqual({
      'shinobi:node': 'platform:my-sg',
      'shinobi:platform': 'aws-security-group',
    });
  });

  it('should be deterministic (run twice, same output)', () => {
    const node = createTestNode({
      id: 'platform:my-sg',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-security-group',
          vpcId: 'platform:my-vpc',
        },
      },
    });

    const result1 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const result2 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result1).toEqual(result2);
  });

  it('should support custom description', () => {
    const node = createTestNode({
      id: 'platform:my-sg',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-security-group',
          vpcId: 'platform:my-vpc',
          description: 'Custom security group',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.description).toBe('Custom security group');
  });

  it('should create multiple ingress rules', () => {
    const node = createTestNode({
      id: 'platform:my-sg',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-security-group',
          vpcId: 'platform:my-vpc',
          ingressRules: [
            { protocol: 'tcp', fromPort: 80, toPort: 80, cidrBlocks: ['0.0.0.0/0'] },
            { protocol: 'tcp', fromPort: 443, toPort: 443, cidrBlocks: ['0.0.0.0/0'] },
          ],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result.length).toBe(4); // sg + 2 ingress + 1 egress
  });

  it('should support source security group in rules', () => {
    const node = createTestNode({
      id: 'platform:my-sg',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-security-group',
          vpcId: 'platform:my-vpc',
          ingressRules: [
            {
              protocol: 'tcp',
              fromPort: 3000,
              toPort: 3000,
              sourceSecurityGroupId: 'platform:other-sg',
            },
          ],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    const ingressRule = result.find((r) => r.name?.includes('ingress'));
    expect(ingressRule?.properties?.sourceSecurityGroupId).toEqual({ ref: 'other-sg-sg' });
  });

  it('should respect custom tags', () => {
    const node = createTestNode({
      id: 'platform:my-sg',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-security-group',
          vpcId: 'platform:my-vpc',
          tags: { Purpose: 'web-tier' },
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.tags).toEqual({
      'shinobi:node': 'platform:my-sg',
      'shinobi:platform': 'aws-security-group',
      Purpose: 'web-tier',
    });
  });
});

describe('EcrLowerer', () => {
  const lowerer = new EcrLowerer();

  it('should lower ECR node to 2 resources (repo + lifecycle)', () => {
    const node = createTestNode({
      id: 'platform:my-ecr',
      type: 'platform',
      metadata: { properties: { platform: 'aws-ecr' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result).toHaveLength(2);
  });

  it('should emit correct resource types', () => {
    const node = createTestNode({
      id: 'platform:my-ecr',
      type: 'platform',
      metadata: { properties: { platform: 'aws-ecr' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.resourceType).toBe('aws:ecr:Repository');
    expect(result[1]?.resourceType).toBe('aws:ecr:LifecyclePolicy');
  });

  it('should follow naming pattern with shortName', () => {
    const node = createTestNode({
      id: 'platform:my-ecr',
      type: 'platform',
      metadata: { properties: { platform: 'aws-ecr' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.name).toBe('my-ecr-repo');
    expect(result[1]?.name).toBe('my-ecr-lifecycle');
  });

  it('should enable image scan on push by default', () => {
    const node = createTestNode({
      id: 'platform:my-ecr',
      type: 'platform',
      metadata: { properties: { platform: 'aws-ecr' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.imageScanningConfiguration).toEqual({
      scanOnPush: true,
    });
  });

  it('should use immutable tags by default', () => {
    const node = createTestNode({
      id: 'platform:my-ecr',
      type: 'platform',
      metadata: { properties: { platform: 'aws-ecr' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.imageTagMutability).toBe('IMMUTABLE');
  });

  it('should respect custom tag mutability', () => {
    const node = createTestNode({
      id: 'platform:my-ecr',
      type: 'platform',
      metadata: {
        properties: { platform: 'aws-ecr', imageTagMutability: 'MUTABLE' },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.imageTagMutability).toBe('MUTABLE');
  });

  it('should set lifecycle policy dependency on repository', () => {
    const node = createTestNode({
      id: 'platform:my-ecr',
      type: 'platform',
      metadata: { properties: { platform: 'aws-ecr' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[1]?.dependsOn).toEqual(['my-ecr-repo']);
  });

  it('should attach repository ref to lifecycle policy', () => {
    const node = createTestNode({
      id: 'platform:my-ecr',
      type: 'platform',
      metadata: { properties: { platform: 'aws-ecr' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[1]?.properties?.repository).toEqual({ ref: 'my-ecr-repo.name' });
  });

  it('should include default lifecycle policy keeping 10 images', () => {
    const node = createTestNode({
      id: 'platform:my-ecr',
      type: 'platform',
      metadata: { properties: { platform: 'aws-ecr' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    const policy = JSON.parse(result[1]?.properties?.policy as string);
    expect(policy.rules[0]?.selection?.countNumber).toBe(10);
  });

  it('should include standard tags on repository', () => {
    const node = createTestNode({
      id: 'platform:my-ecr',
      type: 'platform',
      metadata: { properties: { platform: 'aws-ecr' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.tags).toEqual({
      'shinobi:node': 'platform:my-ecr',
      'shinobi:platform': 'aws-ecr',
    });
  });

  it('should be deterministic (run twice, same output)', () => {
    const node = createTestNode({
      id: 'platform:my-ecr',
      type: 'platform',
      metadata: { properties: { platform: 'aws-ecr' } },
    });

    const result1 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const result2 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result1).toEqual(result2);
  });

  it('should disable scan on push when configured', () => {
    const node = createTestNode({
      id: 'platform:my-ecr',
      type: 'platform',
      metadata: {
        properties: { platform: 'aws-ecr', scanOnPush: false },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.imageScanningConfiguration).toEqual({
      scanOnPush: false,
    });
  });

  it('should support custom image count in lifecycle policy', () => {
    const node = createTestNode({
      id: 'platform:my-ecr',
      type: 'platform',
      metadata: {
        properties: { platform: 'aws-ecr', lifecycleImageCount: 5 },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    const policy = JSON.parse(result[1]?.properties?.policy as string);
    expect(policy.rules[0]?.selection?.countNumber).toBe(5);
  });

  it('should respect custom tags', () => {
    const node = createTestNode({
      id: 'platform:my-ecr',
      type: 'platform',
      metadata: {
        properties: { platform: 'aws-ecr', tags: { App: 'web' } },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.tags).toEqual({
      'shinobi:node': 'platform:my-ecr',
      'shinobi:platform': 'aws-ecr',
      App: 'web',
    });
  });
});

describe('EcsClusterLowerer', () => {
  const lowerer = new EcsClusterLowerer();

  it('should lower ECS Cluster node to 1 resource', () => {
    const node = createTestNode({
      id: 'platform:my-cluster',
      type: 'platform',
      metadata: { properties: { platform: 'aws-ecs-cluster' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result).toHaveLength(1);
  });

  it('should emit correct resource type', () => {
    const node = createTestNode({
      id: 'platform:my-cluster',
      type: 'platform',
      metadata: { properties: { platform: 'aws-ecs-cluster' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.resourceType).toBe('aws:ecs:Cluster');
  });

  it('should follow naming pattern with shortName', () => {
    const node = createTestNode({
      id: 'platform:my-cluster',
      type: 'platform',
      metadata: { properties: { platform: 'aws-ecs-cluster' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.name).toBe('my-cluster-cluster');
  });

  it('should enable container insights by default', () => {
    const node = createTestNode({
      id: 'platform:my-cluster',
      type: 'platform',
      metadata: { properties: { platform: 'aws-ecs-cluster' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.settings).toEqual([
      { name: 'containerInsights', value: 'enabled' },
    ]);
  });

  it('should disable container insights when configured', () => {
    const node = createTestNode({
      id: 'platform:my-cluster',
      type: 'platform',
      metadata: {
        properties: { platform: 'aws-ecs-cluster', containerInsights: false },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.settings).toEqual([
      { name: 'containerInsights', value: 'disabled' },
    ]);
  });

  it('should include standard tags', () => {
    const node = createTestNode({
      id: 'platform:my-cluster',
      type: 'platform',
      metadata: { properties: { platform: 'aws-ecs-cluster' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.tags).toEqual({
      'shinobi:node': 'platform:my-cluster',
      'shinobi:platform': 'aws-ecs-cluster',
    });
  });

  it('should be deterministic (run twice, same output)', () => {
    const node = createTestNode({
      id: 'platform:my-cluster',
      type: 'platform',
      metadata: { properties: { platform: 'aws-ecs-cluster' } },
    });

    const result1 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const result2 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result1).toEqual(result2);
  });

  it('should respect custom tags', () => {
    const node = createTestNode({
      id: 'platform:my-cluster',
      type: 'platform',
      metadata: {
        properties: { platform: 'aws-ecs-cluster', tags: { Environment: 'dev' } },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.tags).toEqual({
      'shinobi:node': 'platform:my-cluster',
      'shinobi:platform': 'aws-ecs-cluster',
      Environment: 'dev',
    });
  });

  it('should handle minimal cluster configuration', () => {
    const node = createTestNode({
      id: 'platform:minimal',
      type: 'platform',
      metadata: { properties: { platform: 'aws-ecs-cluster' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('minimal-cluster');
  });

  it('should set cluster name from node ID', () => {
    const node = createTestNode({
      id: 'platform:prod-cluster',
      type: 'platform',
      metadata: { properties: { platform: 'aws-ecs-cluster' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.name).toBe('prod-cluster-cluster');
  });

  it('should have no dependencies', () => {
    const node = createTestNode({
      id: 'platform:my-cluster',
      type: 'platform',
      metadata: { properties: { platform: 'aws-ecs-cluster' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.dependsOn).toBeUndefined();
  });

  it('should support capacity providers configuration', () => {
    const node = createTestNode({
      id: 'platform:my-cluster',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-ecs-cluster',
          capacityProviders: ['FARGATE', 'FARGATE_SPOT'],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.capacityProviders).toEqual(['FARGATE', 'FARGATE_SPOT']);
  });

  it('should support default capacity provider strategy', () => {
    const node = createTestNode({
      id: 'platform:my-cluster',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-ecs-cluster',
          defaultCapacityProviderStrategy: [
            { capacityProvider: 'FARGATE', weight: 1 },
          ],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.defaultCapacityProviderStrategy).toEqual([
      { capacityProvider: 'FARGATE', weight: 1 },
    ]);
  });
});

describe('EcsTaskDefinitionLowerer', () => {
  const lowerer = new EcsTaskDefinitionLowerer();

  it('should lower TaskDefinition node to 2 resources (log-group + task-def)', () => {
    const node = createTestNode({
      id: 'platform:my-task',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-ecs-task-definition',
          containerDefinitions: [
            {
              name: 'app',
              image: 'nginx:latest',
              cpu: 256,
              memory: 512,
            },
          ],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result).toHaveLength(2);
  });

  it('should emit correct resource types', () => {
    const node = createTestNode({
      id: 'platform:my-task',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-ecs-task-definition',
          containerDefinitions: [
            {
              name: 'app',
              image: 'nginx:latest',
              cpu: 256,
              memory: 512,
            },
          ],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.resourceType).toBe('aws:cloudwatch:LogGroup');
    expect(result[1]?.resourceType).toBe('aws:ecs:TaskDefinition');
  });

  it('should follow naming pattern with shortName', () => {
    const node = createTestNode({
      id: 'platform:my-task',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-ecs-task-definition',
          containerDefinitions: [
            {
              name: 'app',
              image: 'nginx:latest',
              cpu: 256,
              memory: 512,
            },
          ],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.name).toBe('my-task-log-group');
    expect(result[1]?.name).toBe('my-task-task-def');
  });

  it('should default to FARGATE compatibility', () => {
    const node = createTestNode({
      id: 'platform:my-task',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-ecs-task-definition',
          containerDefinitions: [
            {
              name: 'app',
              image: 'nginx:latest',
              cpu: 256,
              memory: 512,
            },
          ],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[1]?.properties?.requiresCompatibilities).toEqual(['FARGATE']);
  });

  it('should use awsvpc network mode by default', () => {
    const node = createTestNode({
      id: 'platform:my-task',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-ecs-task-definition',
          containerDefinitions: [
            {
              name: 'app',
              image: 'nginx:latest',
              cpu: 256,
              memory: 512,
            },
          ],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[1]?.properties?.networkMode).toBe('awsvpc');
  });

  it('should use default CPU and memory values', () => {
    const node = createTestNode({
      id: 'platform:my-task',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-ecs-task-definition',
          containerDefinitions: [
            {
              name: 'app',
              image: 'nginx:latest',
            },
          ],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[1]?.properties?.cpu).toBe('256');
    expect(result[1]?.properties?.memory).toBe('512');
  });

  it('should respect custom CPU and memory', () => {
    const node = createTestNode({
      id: 'platform:my-task',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-ecs-task-definition',
          cpu: '512',
          memory: '1024',
          containerDefinitions: [
            {
              name: 'app',
              image: 'nginx:latest',
            },
          ],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[1]?.properties?.cpu).toBe('512');
    expect(result[1]?.properties?.memory).toBe('1024');
  });

  it('should configure log group with 7 day retention', () => {
    const node = createTestNode({
      id: 'platform:my-task',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-ecs-task-definition',
          containerDefinitions: [
            {
              name: 'app',
              image: 'nginx:latest',
            },
          ],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.retentionInDays).toBe(7);
  });

  it('should set task definition dependency on log group', () => {
    const node = createTestNode({
      id: 'platform:my-task',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-ecs-task-definition',
          containerDefinitions: [
            {
              name: 'app',
              image: 'nginx:latest',
            },
          ],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[1]?.dependsOn).toEqual(['my-task-log-group']);
  });

  it('should serialize container definitions to JSON string', () => {
    const node = createTestNode({
      id: 'platform:my-task',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-ecs-task-definition',
          containerDefinitions: [
            {
              name: 'app',
              image: 'nginx:latest',
              cpu: 256,
              memory: 512,
            },
          ],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    const containerDefs = JSON.parse(
      result[1]?.properties?.containerDefinitions as string
    );
    expect(containerDefs[0]?.name).toBe('app');
    expect(containerDefs[0]?.image).toBe('nginx:latest');
  });

  it('should include standard tags on task definition', () => {
    const node = createTestNode({
      id: 'platform:my-task',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-ecs-task-definition',
          containerDefinitions: [
            {
              name: 'app',
              image: 'nginx:latest',
            },
          ],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[1]?.properties?.tags).toEqual({
      'shinobi:node': 'platform:my-task',
      'shinobi:platform': 'aws-ecs-task-definition',
    });
  });

  it('should be deterministic (run twice, same output)', () => {
    const node = createTestNode({
      id: 'platform:my-task',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-ecs-task-definition',
          containerDefinitions: [
            {
              name: 'app',
              image: 'nginx:latest',
            },
          ],
        },
      },
    });

    const result1 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const result2 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result1).toEqual(result2);
  });

  it('should support multiple container definitions', () => {
    const node = createTestNode({
      id: 'platform:my-task',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-ecs-task-definition',
          containerDefinitions: [
            { name: 'app', image: 'nginx:latest', cpu: 256, memory: 512 },
            { name: 'sidecar', image: 'envoy:latest', cpu: 128, memory: 256 },
          ],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    const containerDefs = JSON.parse(
      result[1]?.properties?.containerDefinitions as string
    );
    expect(containerDefs).toHaveLength(2);
    expect(containerDefs[0]?.name).toBe('app');
    expect(containerDefs[1]?.name).toBe('sidecar');
  });

  it('should support custom retention days', () => {
    const node = createTestNode({
      id: 'platform:my-task',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-ecs-task-definition',
          logRetentionDays: 14,
          containerDefinitions: [
            {
              name: 'app',
              image: 'nginx:latest',
            },
          ],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.retentionInDays).toBe(14);
  });

  it('should respect custom tags', () => {
    const node = createTestNode({
      id: 'platform:my-task',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-ecs-task-definition',
          tags: { Service: 'api' },
          containerDefinitions: [
            {
              name: 'app',
              image: 'nginx:latest',
            },
          ],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[1]?.properties?.tags).toEqual({
      'shinobi:node': 'platform:my-task',
      'shinobi:platform': 'aws-ecs-task-definition',
      Service: 'api',
    });
  });
});

describe('EcsServiceLowerer', () => {
  const lowerer = new EcsServiceLowerer();

  it('should lower ECS Service node to 1 resource', () => {
    const node = createTestNode({
      id: 'platform:my-service',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-ecs-service',
          cluster: 'platform:my-cluster',
          taskDefinition: 'platform:my-task',
          subnets: ['platform:subnet-1a', 'platform:subnet-1b'],
          securityGroups: ['platform:my-sg'],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result).toHaveLength(1);
  });

  it('should emit correct resource type', () => {
    const node = createTestNode({
      id: 'platform:my-service',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-ecs-service',
          cluster: 'platform:my-cluster',
          taskDefinition: 'platform:my-task',
          subnets: ['platform:subnet-1a'],
          securityGroups: ['platform:my-sg'],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.resourceType).toBe('aws:ecs:Service');
  });

  it('should follow naming pattern with shortName', () => {
    const node = createTestNode({
      id: 'platform:my-service',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-ecs-service',
          cluster: 'platform:my-cluster',
          taskDefinition: 'platform:my-task',
          subnets: ['platform:subnet-1a'],
          securityGroups: ['platform:my-sg'],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.name).toBe('my-service-service');
  });

  it('should reference cluster and task definition', () => {
    const node = createTestNode({
      id: 'platform:my-service',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-ecs-service',
          cluster: 'platform:my-cluster',
          taskDefinition: 'platform:my-task',
          subnets: ['platform:subnet-1a'],
          securityGroups: ['platform:my-sg'],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.cluster).toEqual({ ref: 'my-cluster-cluster.arn' });
    expect(result[0]?.properties?.taskDefinition).toEqual({ ref: 'my-task-task-def.arn' });
  });

  it('should default to 1 desired count', () => {
    const node = createTestNode({
      id: 'platform:my-service',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-ecs-service',
          cluster: 'platform:my-cluster',
          taskDefinition: 'platform:my-task',
          subnets: ['platform:subnet-1a'],
          securityGroups: ['platform:my-sg'],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.desiredCount).toBe(1);
  });

  it('should respect custom desired count', () => {
    const node = createTestNode({
      id: 'platform:my-service',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-ecs-service',
          cluster: 'platform:my-cluster',
          taskDefinition: 'platform:my-task',
          desiredCount: 3,
          subnets: ['platform:subnet-1a'],
          securityGroups: ['platform:my-sg'],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.desiredCount).toBe(3);
  });

  it('should use FARGATE launch type by default', () => {
    const node = createTestNode({
      id: 'platform:my-service',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-ecs-service',
          cluster: 'platform:my-cluster',
          taskDefinition: 'platform:my-task',
          subnets: ['platform:subnet-1a'],
          securityGroups: ['platform:my-sg'],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.launchType).toBe('FARGATE');
  });

  it('should configure network configuration with subnets and security groups', () => {
    const node = createTestNode({
      id: 'platform:my-service',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-ecs-service',
          cluster: 'platform:my-cluster',
          taskDefinition: 'platform:my-task',
          subnets: ['platform:subnet-1a', 'platform:subnet-1b'],
          securityGroups: ['platform:my-sg'],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.networkConfiguration).toEqual({
      awsvpcConfiguration: {
        subnets: [{ ref: 'subnet-1a-subnet' }, { ref: 'subnet-1b-subnet' }],
        securityGroups: [{ ref: 'my-sg-sg' }],
        assignPublicIp: false,
      },
    });
  });

  it('should enable public IP when configured', () => {
    const node = createTestNode({
      id: 'platform:my-service',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-ecs-service',
          cluster: 'platform:my-cluster',
          taskDefinition: 'platform:my-task',
          subnets: ['platform:subnet-1a'],
          securityGroups: ['platform:my-sg'],
          assignPublicIp: true,
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(
      result[0]?.properties?.networkConfiguration?.awsvpcConfiguration?.assignPublicIp
    ).toBe(true);
  });

  it('should set dependencies on cluster and task definition', () => {
    const node = createTestNode({
      id: 'platform:my-service',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-ecs-service',
          cluster: 'platform:my-cluster',
          taskDefinition: 'platform:my-task',
          subnets: ['platform:subnet-1a'],
          securityGroups: ['platform:my-sg'],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.dependsOn).toEqual(['my-cluster-cluster', 'my-task-task-def']);
  });

  it('should include standard tags', () => {
    const node = createTestNode({
      id: 'platform:my-service',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-ecs-service',
          cluster: 'platform:my-cluster',
          taskDefinition: 'platform:my-task',
          subnets: ['platform:subnet-1a'],
          securityGroups: ['platform:my-sg'],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.tags).toEqual({
      'shinobi:node': 'platform:my-service',
      'shinobi:platform': 'aws-ecs-service',
    });
  });

  it('should be deterministic (run twice, same output)', () => {
    const node = createTestNode({
      id: 'platform:my-service',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-ecs-service',
          cluster: 'platform:my-cluster',
          taskDefinition: 'platform:my-task',
          subnets: ['platform:subnet-1a'],
          securityGroups: ['platform:my-sg'],
        },
      },
    });

    const result1 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const result2 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result1).toEqual(result2);
  });

  it('should support load balancer configuration', () => {
    const node = createTestNode({
      id: 'platform:my-service',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-ecs-service',
          cluster: 'platform:my-cluster',
          taskDefinition: 'platform:my-task',
          subnets: ['platform:subnet-1a'],
          securityGroups: ['platform:my-sg'],
          loadBalancers: [
            {
              targetGroupArn: 'platform:my-tg',
              containerName: 'app',
              containerPort: 80,
            },
          ],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.loadBalancers).toEqual([
      {
        targetGroupArn: { ref: 'my-tg-tg.arn' },
        containerName: 'app',
        containerPort: 80,
      },
    ]);
  });

  it('should respect custom tags', () => {
    const node = createTestNode({
      id: 'platform:my-service',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-ecs-service',
          cluster: 'platform:my-cluster',
          taskDefinition: 'platform:my-task',
          subnets: ['platform:subnet-1a'],
          securityGroups: ['platform:my-sg'],
          tags: { Tier: 'web' },
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.tags).toEqual({
      'shinobi:node': 'platform:my-service',
      'shinobi:platform': 'aws-ecs-service',
      Tier: 'web',
    });
  });

  it('should support health check grace period', () => {
    const node = createTestNode({
      id: 'platform:my-service',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-ecs-service',
          cluster: 'platform:my-cluster',
          taskDefinition: 'platform:my-task',
          subnets: ['platform:subnet-1a'],
          securityGroups: ['platform:my-sg'],
          healthCheckGracePeriodSeconds: 60,
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.healthCheckGracePeriodSeconds).toBe(60);
  });
});

describe('AlbLowerer', () => {
  const lowerer = new AlbLowerer();

  it('should lower ALB node to 4 resources (alb, tg, listener-https, listener-http)', () => {
    const node = createTestNode({
      id: 'platform:my-alb',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-alb',
          subnets: ['platform:subnet-1a', 'platform:subnet-1b'],
          securityGroups: ['platform:my-sg'],
          vpcId: 'platform:my-vpc',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result).toHaveLength(4);
  });

  it('should emit correct resource types', () => {
    const node = createTestNode({
      id: 'platform:my-alb',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-alb',
          subnets: ['platform:subnet-1a', 'platform:subnet-1b'],
          securityGroups: ['platform:my-sg'],
          vpcId: 'platform:my-vpc',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.resourceType).toBe('aws:lb:LoadBalancer');
    expect(result[1]?.resourceType).toBe('aws:lb:TargetGroup');
    expect(result[2]?.resourceType).toBe('aws:lb:Listener');
    expect(result[3]?.resourceType).toBe('aws:lb:Listener');
  });

  it('should follow naming pattern with shortName', () => {
    const node = createTestNode({
      id: 'platform:my-alb',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-alb',
          subnets: ['platform:subnet-1a', 'platform:subnet-1b'],
          securityGroups: ['platform:my-sg'],
          vpcId: 'platform:my-vpc',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.name).toBe('my-alb-alb');
    expect(result[1]?.name).toBe('my-alb-tg');
    expect(result[2]?.name).toBe('my-alb-listener-https');
    expect(result[3]?.name).toBe('my-alb-listener-http');
  });

  it('should configure ALB as application type', () => {
    const node = createTestNode({
      id: 'platform:my-alb',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-alb',
          subnets: ['platform:subnet-1a'],
          securityGroups: ['platform:my-sg'],
          vpcId: 'platform:my-vpc',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.loadBalancerType).toBe('application');
  });

  it('should not be internal by default', () => {
    const node = createTestNode({
      id: 'platform:my-alb',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-alb',
          subnets: ['platform:subnet-1a'],
          securityGroups: ['platform:my-sg'],
          vpcId: 'platform:my-vpc',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.internal).toBe(false);
  });

  it('should respect internal configuration', () => {
    const node = createTestNode({
      id: 'platform:my-alb',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-alb',
          subnets: ['platform:subnet-1a'],
          securityGroups: ['platform:my-sg'],
          vpcId: 'platform:my-vpc',
          internal: true,
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.internal).toBe(true);
  });

  it('should reference subnets and security groups', () => {
    const node = createTestNode({
      id: 'platform:my-alb',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-alb',
          subnets: ['platform:subnet-1a', 'platform:subnet-1b'],
          securityGroups: ['platform:my-sg'],
          vpcId: 'platform:my-vpc',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.subnets).toEqual([
      { ref: 'subnet-1a-subnet' },
      { ref: 'subnet-1b-subnet' },
    ]);
    expect(result[0]?.properties?.securityGroups).toEqual([{ ref: 'my-sg-sg' }]);
  });

  it('should configure target group with IP target type', () => {
    const node = createTestNode({
      id: 'platform:my-alb',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-alb',
          subnets: ['platform:subnet-1a'],
          securityGroups: ['platform:my-sg'],
          vpcId: 'platform:my-vpc',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[1]?.properties?.targetType).toBe('ip');
  });

  it('should configure target group with HTTP protocol and port 80', () => {
    const node = createTestNode({
      id: 'platform:my-alb',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-alb',
          subnets: ['platform:subnet-1a'],
          securityGroups: ['platform:my-sg'],
          vpcId: 'platform:my-vpc',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[1]?.properties?.protocol).toBe('HTTP');
    expect(result[1]?.properties?.port).toBe(80);
  });

  it('should reference VPC in target group', () => {
    const node = createTestNode({
      id: 'platform:my-alb',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-alb',
          subnets: ['platform:subnet-1a'],
          securityGroups: ['platform:my-sg'],
          vpcId: 'platform:my-vpc',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[1]?.properties?.vpcId).toEqual({ ref: 'my-vpc-vpc' });
  });

  it('should configure HTTPS listener on port 443', () => {
    const node = createTestNode({
      id: 'platform:my-alb',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-alb',
          subnets: ['platform:subnet-1a'],
          securityGroups: ['platform:my-sg'],
          vpcId: 'platform:my-vpc',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    const httpsListener = result.find((r) => r.name === 'my-alb-listener-https');
    expect(httpsListener?.properties?.protocol).toBe('HTTPS');
    expect(httpsListener?.properties?.port).toBe(443);
  });

  it('should configure HTTP listener on port 80', () => {
    const node = createTestNode({
      id: 'platform:my-alb',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-alb',
          subnets: ['platform:subnet-1a'],
          securityGroups: ['platform:my-sg'],
          vpcId: 'platform:my-vpc',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    const httpListener = result.find((r) => r.name === 'my-alb-listener-http');
    expect(httpListener?.properties?.protocol).toBe('HTTP');
    expect(httpListener?.properties?.port).toBe(80);
  });

  it('should set listener dependencies on ALB and target group', () => {
    const node = createTestNode({
      id: 'platform:my-alb',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-alb',
          subnets: ['platform:subnet-1a'],
          securityGroups: ['platform:my-sg'],
          vpcId: 'platform:my-vpc',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[2]?.dependsOn).toEqual(['my-alb-alb', 'my-alb-tg']);
    expect(result[3]?.dependsOn).toEqual(['my-alb-alb', 'my-alb-tg']);
  });

  it('should configure default forward action for listeners', () => {
    const node = createTestNode({
      id: 'platform:my-alb',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-alb',
          subnets: ['platform:subnet-1a'],
          securityGroups: ['platform:my-sg'],
          vpcId: 'platform:my-vpc',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    const httpsListener = result.find((r) => r.name === 'my-alb-listener-https');
    expect(httpsListener?.properties?.defaultActions).toEqual([
      {
        type: 'forward',
        targetGroupArn: { ref: 'my-alb-tg.arn' },
      },
    ]);
  });

  it('should include standard tags on all taggable resources', () => {
    const node = createTestNode({
      id: 'platform:my-alb',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-alb',
          subnets: ['platform:subnet-1a'],
          securityGroups: ['platform:my-sg'],
          vpcId: 'platform:my-vpc',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.tags).toEqual({
      'shinobi:node': 'platform:my-alb',
      'shinobi:platform': 'aws-alb',
    });
    expect(result[1]?.properties?.tags).toEqual({
      'shinobi:node': 'platform:my-alb',
      'shinobi:platform': 'aws-alb',
    });
  });

  it('should be deterministic (run twice, same output)', () => {
    const node = createTestNode({
      id: 'platform:my-alb',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-alb',
          subnets: ['platform:subnet-1a'],
          securityGroups: ['platform:my-sg'],
          vpcId: 'platform:my-vpc',
        },
      },
    });

    const result1 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const result2 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result1).toEqual(result2);
  });

  it('should respect custom tags', () => {
    const node = createTestNode({
      id: 'platform:my-alb',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-alb',
          subnets: ['platform:subnet-1a'],
          securityGroups: ['platform:my-sg'],
          vpcId: 'platform:my-vpc',
          tags: { Tier: 'public' },
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[0]?.properties?.tags).toEqual({
      'shinobi:node': 'platform:my-alb',
      'shinobi:platform': 'aws-alb',
      Tier: 'public',
    });
  });

  it('should support custom health check configuration', () => {
    const node = createTestNode({
      id: 'platform:my-alb',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-alb',
          subnets: ['platform:subnet-1a'],
          securityGroups: ['platform:my-sg'],
          vpcId: 'platform:my-vpc',
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

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);

    expect(result[1]?.properties?.healthCheck).toEqual({
      path: '/health',
      interval: 30,
      timeout: 5,
      healthyThreshold: 2,
      unhealthyThreshold: 3,
    });
  });
});
