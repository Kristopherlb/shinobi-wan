import { describe, it, expect } from 'vitest';
import { BedrockLowerer } from '../lowerers/bedrock-lowerer';
import { makeNode, makeDefaultContext, makeDefaultDeps } from './test-helpers';

const DEFAULT_CONTEXT = makeDefaultContext({ adapterConfig: { region: 'us-east-1', serviceName: 'my-service' } });
const DEFAULT_DEPS = makeDefaultDeps();

describe('BedrockLowerer', () => {
  const lowerer = new BedrockLowerer();

  it('has correct platform', () => {
    expect(lowerer.platform).toBe('aws-bedrock');
  });

  it('produces Guardrail when guardrailEnabled is true', () => {
    const node = makeNode({
      id: 'platform:llm',
      type: 'platform',
      metadata: { properties: { platform: 'aws-bedrock', guardrailEnabled: true } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources).toHaveLength(1);
    expect(resources[0].resourceType).toBe('aws:bedrock:Guardrail');
    expect(resources[0].name).toBe('llm-bedrock-guardrail');
  });

  it('produces Guardrail + LogGroup when both enabled', () => {
    const node = makeNode({
      id: 'platform:llm',
      type: 'platform',
      metadata: { properties: { platform: 'aws-bedrock', guardrailEnabled: true, invocationLogging: true } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources).toHaveLength(2);
    expect(resources[0].resourceType).toBe('aws:bedrock:Guardrail');
    expect(resources[1].resourceType).toBe('aws:cloudwatch:LogGroup');
  });

  it('produces LogGroup with correct name', () => {
    const node = makeNode({
      id: 'platform:llm',
      type: 'platform',
      metadata: { properties: { platform: 'aws-bedrock', invocationLogging: true } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const logGroup = resources.find((r) => r.resourceType === 'aws:cloudwatch:LogGroup');
    expect(logGroup?.properties['name']).toBe('/aws/bedrock/my-service-llm');
  });

  it('defaults log retention to 30 days', () => {
    const node = makeNode({
      id: 'platform:llm',
      type: 'platform',
      metadata: { properties: { platform: 'aws-bedrock', invocationLogging: true } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const logGroup = resources.find((r) => r.resourceType === 'aws:cloudwatch:LogGroup');
    expect(logGroup?.properties['retentionInDays']).toBe(30);
  });

  it('uses custom log retention days', () => {
    const node = makeNode({
      id: 'platform:llm',
      type: 'platform',
      metadata: { properties: { platform: 'aws-bedrock', invocationLogging: true, logRetentionDays: 90 } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const logGroup = resources.find((r) => r.resourceType === 'aws:cloudwatch:LogGroup');
    expect(logGroup?.properties['retentionInDays']).toBe(90);
  });

  it('produces fallback guardrail when nothing is enabled', () => {
    const node = makeNode({
      id: 'platform:llm',
      type: 'platform',
      metadata: { properties: { platform: 'aws-bedrock' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources).toHaveLength(1);
    expect(resources[0].resourceType).toBe('aws:bedrock:Guardrail');
    expect(resources[0].name).toBe('llm-bedrock-config');
  });

  it('sets correct tags', () => {
    const node = makeNode({
      id: 'platform:llm',
      type: 'platform',
      metadata: { properties: { platform: 'aws-bedrock', guardrailEnabled: true } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = resources[0].properties['tags'] as Record<string, string>;
    expect(tags['shinobi:node']).toBe('platform:llm');
    expect(tags['shinobi:platform']).toBe('aws-bedrock');
  });

  it('sets sourceId to node ID', () => {
    const node = makeNode({
      id: 'platform:llm',
      type: 'platform',
      metadata: { properties: { platform: 'aws-bedrock', guardrailEnabled: true } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    for (const r of resources) {
      expect(r.sourceId).toBe('platform:llm');
    }
  });

  it('output is deterministic', () => {
    const node = makeNode({
      id: 'platform:llm',
      type: 'platform',
      metadata: { properties: { platform: 'aws-bedrock', guardrailEnabled: true, invocationLogging: true } },
    });

    const r1 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const r2 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it('passes custom tags', () => {
    const node = makeNode({
      id: 'platform:llm',
      type: 'platform',
      metadata: { properties: { platform: 'aws-bedrock', guardrailEnabled: true, tags: { team: 'ml' } } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = resources[0].properties['tags'] as Record<string, string>;
    expect(tags['team']).toBe('ml');
  });
});
