import { describe, it, expect } from 'vitest';
import { createTestNode, createSnapshot } from '@shinobi/ir';
import { NetworkIntentLowerer } from '../lowerers/network-lowerer';
import { makeNetworkIntent, DEFAULT_ADAPTER_CONFIG } from './test-helpers';
import type { LoweringContext } from '../types';

const lowerer = new NetworkIntentLowerer();

function sgNode(id: string) {
  return createTestNode({
    id,
    type: 'platform',
    metadata: { properties: { platform: 'aws-security-group' } },
  });
}

function contextWith(
  nodes: ReturnType<typeof createTestNode>[],
): LoweringContext {
  return {
    intents: [],
    snapshot: createSnapshot(nodes, [], []),
    adapterConfig: DEFAULT_ADAPTER_CONFIG,
  };
}

const SG_CONTEXT = contextWith([
  sgNode('platform:app-sg'),
  sgNode('platform:db-sg'),
]);

describe('NetworkIntentLowerer', () => {
  it('emits an ingress rule on the destination SG scoped to the source SG', () => {
    const intent = makeNetworkIntent({
      direction: 'ingress',
      source: { nodeRef: 'platform:app-sg' },
      destination: { nodeRef: 'platform:db-sg', port: 5432 },
      protocol: { protocol: 'tcp' },
    });

    const resources = lowerer.lower(intent, SG_CONTEXT);

    expect(resources).toHaveLength(1);
    const rule = resources[0];
    expect(rule?.resourceType).toBe('aws:ec2:SecurityGroupRule');
    expect(rule?.properties).toMatchObject({
      securityGroupId: { ref: 'db-sg-sg' },
      resourceType: 'ingress',
      protocol: 'tcp',
      fromPort: 5432,
      toPort: 5432,
      sourceSecurityGroupId: { ref: 'app-sg-sg' },
    });
    expect(rule?.dependsOn).toEqual(['db-sg-sg', 'app-sg-sg']);
  });

  it('emits an egress rule on the source SG', () => {
    const intent = makeNetworkIntent({
      direction: 'egress',
      source: { nodeRef: 'platform:app-sg', port: 443 },
      destination: { nodeRef: 'platform:db-sg' },
      protocol: { protocol: 'tcp' },
    });

    const resources = lowerer.lower(intent, SG_CONTEXT);

    expect(resources).toHaveLength(1);
    expect(resources[0]?.properties).toMatchObject({
      securityGroupId: { ref: 'app-sg-sg' },
      resourceType: 'egress',
      sourceSecurityGroupId: { ref: 'db-sg-sg' },
    });
  });

  it('emits one rule per port from protocol.ports, sorted', () => {
    const intent = makeNetworkIntent({
      direction: 'ingress',
      source: { nodeRef: 'platform:app-sg' },
      destination: { nodeRef: 'platform:db-sg' },
      protocol: { protocol: 'tcp', ports: [9092, 2181] },
    });

    const resources = lowerer.lower(intent, SG_CONTEXT);

    expect(resources.map((r) => r.properties['fromPort'])).toEqual([
      2181, 9092,
    ]);
  });

  it('uses the port range when provided', () => {
    const intent = makeNetworkIntent({
      direction: 'ingress',
      source: { nodeRef: 'platform:app-sg' },
      destination: {
        nodeRef: 'platform:db-sg',
        portRange: { from: 9000, to: 9100 },
      },
      protocol: { protocol: 'tcp' },
    });

    const resources = lowerer.lower(intent, SG_CONTEXT);

    expect(resources[0]?.properties).toMatchObject({
      fromPort: 9000,
      toPort: 9100,
    });
  });

  it("maps protocol 'any' to -1 allow-all between the two SGs", () => {
    const intent = makeNetworkIntent({
      direction: 'ingress',
      source: { nodeRef: 'platform:app-sg' },
      destination: { nodeRef: 'platform:db-sg' },
      protocol: { protocol: 'any' },
    });

    const resources = lowerer.lower(intent, SG_CONTEXT);

    expect(resources[0]?.properties).toMatchObject({
      protocol: '-1',
      fromPort: 0,
      toPort: 0,
    });
  });

  it('emits nothing when an endpoint is not a security group', () => {
    const context = contextWith([
      sgNode('platform:app-sg'),
      createTestNode({
        id: 'platform:work-queue',
        type: 'platform',
        metadata: { properties: { platform: 'aws-sqs' } },
      }),
    ]);
    const intent = makeNetworkIntent({
      direction: 'ingress',
      source: { nodeRef: 'platform:app-sg' },
      destination: { nodeRef: 'platform:work-queue', port: 443 },
      protocol: { protocol: 'tcp' },
    });

    expect(lowerer.lower(intent, context)).toEqual([]);
  });

  it('emits nothing rather than guessing when no port information exists', () => {
    const intent = makeNetworkIntent({
      direction: 'ingress',
      source: { nodeRef: 'platform:app-sg' },
      destination: { nodeRef: 'platform:db-sg' },
      protocol: { protocol: 'tcp' },
    });

    expect(lowerer.lower(intent, SG_CONTEXT)).toEqual([]);
  });

  it('determinism: identical input produces identical output', () => {
    const intent = makeNetworkIntent({
      direction: 'ingress',
      source: { nodeRef: 'platform:app-sg' },
      destination: { nodeRef: 'platform:db-sg', port: 5432 },
      protocol: { protocol: 'tcp' },
    });

    expect(JSON.stringify(lowerer.lower(intent, SG_CONTEXT))).toBe(
      JSON.stringify(lowerer.lower(intent, SG_CONTEXT)),
    );
  });
});
