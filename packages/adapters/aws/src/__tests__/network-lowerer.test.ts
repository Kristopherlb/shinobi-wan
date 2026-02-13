import { describe, it, expect } from 'vitest';
import { NetworkIntentLowerer } from '../lowerers/network-lowerer';
import { makeNetworkIntent, makeContext } from './test-helpers';

const lowerer = new NetworkIntentLowerer();

describe('NetworkIntentLowerer', () => {
  it('produces a SecurityGroupRule resource', () => {
    const intent = makeNetworkIntent();
    const resources = lowerer.lower(intent, makeContext());

    expect(resources).toHaveLength(1);
    expect(resources[0].resourceType).toBe('aws:ec2:SecurityGroupRule');
  });

  it('name derives from source and destination', () => {
    const intent = makeNetworkIntent();
    const resources = lowerer.lower(intent, makeContext());

    expect(resources[0].name).toBe('api-handler-to-work-queue-egress');
  });

  it('maps tcp protocol correctly', () => {
    const intent = makeNetworkIntent({ protocol: { protocol: 'tcp' } });
    const resources = lowerer.lower(intent, makeContext());

    expect(resources[0].properties['protocol']).toBe('tcp');
  });

  it('maps "any" protocol to -1', () => {
    const intent = makeNetworkIntent({ protocol: { protocol: 'any' } });
    const resources = lowerer.lower(intent, makeContext());

    expect(resources[0].properties['protocol']).toBe('-1');
  });

  it('uses destination port', () => {
    const intent = makeNetworkIntent({
      destination: { nodeRef: 'platform:work-queue', port: 443 },
    });
    const resources = lowerer.lower(intent, makeContext());

    expect(resources[0].properties['fromPort']).toBe(443);
    expect(resources[0].properties['toPort']).toBe(443);
  });

  it('maps egress direction correctly', () => {
    const intent = makeNetworkIntent({ direction: 'egress' });
    const resources = lowerer.lower(intent, makeContext());

    expect(resources[0].properties['type']).toBe('egress');
  });

  it('maps ingress direction correctly', () => {
    const intent = makeNetworkIntent({ direction: 'ingress' });
    const resources = lowerer.lower(intent, makeContext());

    expect(resources[0].properties['type']).toBe('ingress');
  });

  it('carries source edge ID tag', () => {
    const intent = makeNetworkIntent();
    const resources = lowerer.lower(intent, makeContext());

    const tags = resources[0].properties['tags'] as Record<string, string>;
    expect(tags['shinobi:edge']).toBe(intent.sourceEdgeId);
  });

  it('determinism: identical input produces identical output', () => {
    const intent = makeNetworkIntent();
    const ctx = makeContext();
    const r1 = lowerer.lower(intent, ctx);
    const r2 = lowerer.lower(intent, ctx);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});
