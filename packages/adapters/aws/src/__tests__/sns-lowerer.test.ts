import { describe, it, expect } from 'vitest';
import { SnsLowerer } from '../lowerers/sns-lowerer';
import { makeNode } from './test-helpers';
import type { LoweringContext, ResolvedDeps } from '../types';
import { createSnapshot } from '@shinobi/ir';

const DEFAULT_CONTEXT: LoweringContext = {
  intents: [],
  snapshot: createSnapshot([], []),
  adapterConfig: {
    region: 'us-east-1',
    serviceName: 'my-service',
  },
};

const DEFAULT_DEPS: ResolvedDeps = {
  envVars: {},
  securityGroups: [],
};

describe('SnsLowerer', () => {
  const lowerer = new SnsLowerer();

  it('has correct platform', () => {
    expect(lowerer.platform).toBe('aws-sns');
  });

  it('produces Topic resource', () => {
    const node = makeNode({
      id: 'platform:notifications',
      type: 'platform',
      metadata: { properties: { platform: 'aws-sns' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources).toHaveLength(1);
    expect(resources[0].resourceType).toBe('aws:sns:Topic');
  });

  it('uses correct naming convention', () => {
    const node = makeNode({
      id: 'platform:alerts',
      type: 'platform',
      metadata: { properties: { platform: 'aws-sns' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].name).toBe('alerts-topic');
    expect(resources[0].properties['name']).toBe('my-service-alerts');
  });

  it('sets correct tags', () => {
    const node = makeNode({
      id: 'platform:notifications',
      type: 'platform',
      metadata: { properties: { platform: 'aws-sns' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = resources[0].properties['tags'] as Record<string, string>;
    expect(tags['shinobi:node']).toBe('platform:notifications');
    expect(tags['shinobi:platform']).toBe('aws-sns');
  });

  it('has no dependencies', () => {
    const node = makeNode({
      id: 'platform:notifications',
      type: 'platform',
      metadata: { properties: { platform: 'aws-sns' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].dependsOn).toEqual([]);
  });

  it('sets sourceId to node ID', () => {
    const node = makeNode({
      id: 'platform:notifications',
      type: 'platform',
      metadata: { properties: { platform: 'aws-sns' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].sourceId).toBe('platform:notifications');
  });

  it('extracts short name correctly from composite ID', () => {
    const node = makeNode({
      id: 'platform:my-topic',
      type: 'platform',
      metadata: { properties: { platform: 'aws-sns' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].name).toBe('my-topic-topic');
  });

  it('output is deterministic', () => {
    const node = makeNode({
      id: 'platform:notifications',
      type: 'platform',
      metadata: { properties: { platform: 'aws-sns' } },
    });

    const r1 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const r2 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});
