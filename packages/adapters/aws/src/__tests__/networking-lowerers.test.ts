import { describe, it, expect } from 'vitest';
import { createTestNode } from '@shinobi/ir';
import { makeDefaultContext, makeDefaultDeps } from './test-helpers';
import { TransitGatewayLowerer } from '../lowerers/transit-gateway-lowerer';
import { TgwVpcAttachmentLowerer } from '../lowerers/tgw-vpc-attachment-lowerer';
import { NatGatewayLowerer } from '../lowerers/nat-gateway-lowerer';
import { NetworkFirewallLowerer } from '../lowerers/network-firewall-lowerer';

const DEFAULT_CONTEXT = makeDefaultContext();
const DEFAULT_DEPS = makeDefaultDeps();

describe('TransitGatewayLowerer', () => {
  const lowerer = new TransitGatewayLowerer();

  it('should emit 2 resources (tgw + route table)', () => {
    const node = createTestNode({
      id: 'platform:transit-gw',
      type: 'platform',
      metadata: { properties: { platform: 'aws-transit-gateway' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result).toHaveLength(2);
    expect(result[0]?.resourceType).toBe('aws:ec2transitgateway:TransitGateway');
    expect(result[1]?.resourceType).toBe('aws:ec2transitgateway:RouteTable');
  });

  it('should follow naming pattern', () => {
    const node = createTestNode({
      id: 'platform:transit-gw',
      type: 'platform',
      metadata: { properties: { platform: 'aws-transit-gateway' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.name).toBe('transit-gw-tgw');
    expect(result[1]?.name).toBe('transit-gw-tgw-rt');
  });

  it('route table should depend on tgw', () => {
    const node = createTestNode({
      id: 'platform:tgw',
      type: 'platform',
      metadata: { properties: { platform: 'aws-transit-gateway' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[1]?.dependsOn).toContain('tgw-tgw');
  });

  it('should default auto-accept to disable', () => {
    const node = createTestNode({
      id: 'platform:tgw',
      type: 'platform',
      metadata: { properties: { platform: 'aws-transit-gateway' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.autoAcceptSharedAttachments).toBe('disable');
  });

  it('should default ASN to 64512', () => {
    const node = createTestNode({
      id: 'platform:tgw',
      type: 'platform',
      metadata: { properties: { platform: 'aws-transit-gateway' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.amazonSideAsn).toBe(64512);
  });

  it('should include standard tags', () => {
    const node = createTestNode({
      id: 'platform:tgw',
      type: 'platform',
      metadata: { properties: { platform: 'aws-transit-gateway' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = result[0]?.properties?.tags as Record<string, string>;
    expect(tags?.['shinobi:platform']).toBe('aws-transit-gateway');
  });
});

describe('TgwVpcAttachmentLowerer', () => {
  const lowerer = new TgwVpcAttachmentLowerer();

  it('should emit 1 resource (attachment)', () => {
    const node = createTestNode({
      id: 'platform:hub-attach',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-tgw-vpc-attachment',
          transitGatewayRef: 'platform:transit-gw',
          vpcRef: 'platform:hub-vpc',
          subnetIds: ['platform:hub-subnet'],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result).toHaveLength(1);
    expect(result[0]?.resourceType).toBe('aws:ec2transitgateway:VpcAttachment');
    expect(result[0]?.name).toBe('hub-attach-tgw-attachment');
  });

  it('should resolve transit gateway and VPC refs', () => {
    const node = createTestNode({
      id: 'platform:attach',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-tgw-vpc-attachment',
          transitGatewayRef: 'platform:transit-gw',
          vpcRef: 'platform:hub-vpc',
          subnetIds: ['platform:hub-subnet'],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.transitGatewayId).toEqual({ ref: 'transit-gw-tgw' });
    expect(result[0]?.properties?.vpcId).toEqual({ ref: 'hub-vpc-vpc' });
  });

  it('should resolve subnet refs', () => {
    const node = createTestNode({
      id: 'platform:attach',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-tgw-vpc-attachment',
          subnetIds: ['platform:subnet-a', 'platform:subnet-b'],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.subnetIds).toEqual([
      { ref: 'subnet-a-subnet' },
      { ref: 'subnet-b-subnet' },
    ]);
  });

  it('should default DNS support to enable', () => {
    const node = createTestNode({
      id: 'platform:attach',
      type: 'platform',
      metadata: { properties: { platform: 'aws-tgw-vpc-attachment' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.dnsSupport).toBe('enable');
  });
});

describe('NatGatewayLowerer', () => {
  const lowerer = new NatGatewayLowerer();

  it('should emit 2 resources (eip + nat)', () => {
    const node = createTestNode({
      id: 'platform:nat-gw',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-nat-gateway',
          subnetRef: 'platform:public-subnet',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result).toHaveLength(2);
    expect(result[0]?.resourceType).toBe('aws:ec2:Eip');
    expect(result[1]?.resourceType).toBe('aws:ec2:NatGateway');
  });

  it('should follow naming pattern', () => {
    const node = createTestNode({
      id: 'platform:nat-gw',
      type: 'platform',
      metadata: { properties: { platform: 'aws-nat-gateway' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.name).toBe('nat-gw-eip');
    expect(result[1]?.name).toBe('nat-gw-nat');
  });

  it('nat should depend on eip', () => {
    const node = createTestNode({
      id: 'platform:nat-gw',
      type: 'platform',
      metadata: { properties: { platform: 'aws-nat-gateway' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[1]?.dependsOn).toContain('nat-gw-eip');
  });

  it('should resolve subnet ref', () => {
    const node = createTestNode({
      id: 'platform:nat-gw',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-nat-gateway',
          subnetRef: 'platform:public-subnet',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[1]?.properties?.subnetId).toEqual({ ref: 'public-subnet-subnet' });
  });

  it('should default connectivity type to public', () => {
    const node = createTestNode({
      id: 'platform:nat-gw',
      type: 'platform',
      metadata: { properties: { platform: 'aws-nat-gateway' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[1]?.properties?.connectivityType).toBe('public');
  });
});

describe('NetworkFirewallLowerer', () => {
  const lowerer = new NetworkFirewallLowerer();

  it('should emit 4 resources with logging enabled (policy + firewall + log group + logging config)', () => {
    const node = createTestNode({
      id: 'platform:network-fw',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-network-firewall',
          vpcRef: 'platform:hub-vpc',
          subnetMappings: ['platform:fw-subnet'],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result).toHaveLength(4);
    expect(result[0]?.resourceType).toBe('aws:networkfirewall:FirewallPolicy');
    expect(result[1]?.resourceType).toBe('aws:networkfirewall:Firewall');
    expect(result[2]?.resourceType).toBe('aws:cloudwatch:LogGroup');
    expect(result[3]?.resourceType).toBe('aws:networkfirewall:LoggingConfiguration');
  });

  it('should emit 2 resources when logging disabled', () => {
    const node = createTestNode({
      id: 'platform:network-fw',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-network-firewall',
          loggingEnabled: false,
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result).toHaveLength(2);
  });

  it('should follow naming pattern', () => {
    const node = createTestNode({
      id: 'platform:network-fw',
      type: 'platform',
      metadata: { properties: { platform: 'aws-network-firewall' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.name).toBe('network-fw-fw-policy');
    expect(result[1]?.name).toBe('network-fw-fw');
  });

  it('firewall should depend on policy', () => {
    const node = createTestNode({
      id: 'platform:fw',
      type: 'platform',
      metadata: { properties: { platform: 'aws-network-firewall' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[1]?.dependsOn).toContain('fw-fw-policy');
  });

  it('logging config should depend on firewall and log group', () => {
    const node = createTestNode({
      id: 'platform:fw',
      type: 'platform',
      metadata: { properties: { platform: 'aws-network-firewall' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[3]?.dependsOn).toContain('fw-fw');
    expect(result[3]?.dependsOn).toContain('fw-fw-log-group');
  });

  it('should resolve VPC ref', () => {
    const node = createTestNode({
      id: 'platform:fw',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-network-firewall',
          vpcRef: 'platform:hub-vpc',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[1]?.properties?.vpcId).toEqual({ ref: 'hub-vpc-vpc' });
  });

  it('should resolve subnet mappings', () => {
    const node = createTestNode({
      id: 'platform:fw',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-network-firewall',
          subnetMappings: ['platform:fw-subnet-1', 'platform:fw-subnet-2'],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[1]?.properties?.subnetMappings).toEqual([
      { subnetId: { ref: 'fw-subnet-1-subnet' } },
      { subnetId: { ref: 'fw-subnet-2-subnet' } },
    ]);
  });

  it('should default to delete protection enabled', () => {
    const node = createTestNode({
      id: 'platform:fw',
      type: 'platform',
      metadata: { properties: { platform: 'aws-network-firewall' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[1]?.properties?.deleteProtection).toBe(true);
  });

  it('should include standard tags', () => {
    const node = createTestNode({
      id: 'platform:fw',
      type: 'platform',
      metadata: { properties: { platform: 'aws-network-firewall' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = result[0]?.properties?.tags as Record<string, string>;
    expect(tags?.['shinobi:platform']).toBe('aws-network-firewall');
  });
});
