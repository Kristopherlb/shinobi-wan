import { describe, it, expect } from 'vitest';
import { TelemetryIntentLowerer } from '../lowerers/telemetry-lowerer';
import type { TelemetryIntent } from '@shinobi/contracts';
import type { LoweringContext } from '../types';
import { createSnapshot } from '@shinobi/ir';

const DEFAULT_CONTEXT: LoweringContext = {
  intents: [],
  snapshot: createSnapshot([], []),
  adapterConfig: {
    region: 'us-east-1',
    serviceName: 'my-service',
  },
};

function makeTelemetryIntent(overrides?: Partial<TelemetryIntent>): TelemetryIntent {
  return {
    type: 'telemetry',
    schemaVersion: '1.0.0',
    sourceEdgeId: 'edge:bindsTo:component:handler:platform:queue',
    targetNodeRef: 'component:handler',
    telemetryType: 'traces',
    config: { enabled: true },
    ...overrides,
  };
}

describe('TelemetryIntentLowerer', () => {
  const lowerer = new TelemetryIntentLowerer();

  it('has correct intentType', () => {
    expect(lowerer.intentType).toBe('telemetry');
  });

  it('returns empty array when telemetry is disabled', () => {
    const intent = makeTelemetryIntent({
      config: { enabled: false },
    });
    const resources = lowerer.lower(intent, DEFAULT_CONTEXT);
    expect(resources).toHaveLength(0);
  });

  it('emits X-Ray policy and attachment for traces type', () => {
    const intent = makeTelemetryIntent();
    const resources = lowerer.lower(intent, DEFAULT_CONTEXT);
    expect(resources).toHaveLength(2);
    expect(resources[0].resourceType).toBe('aws:iam:Policy');
    expect(resources[1].resourceType).toBe('aws:iam:RolePolicyAttachment');
  });

  it('X-Ray policy includes correct actions', () => {
    const intent = makeTelemetryIntent();
    const resources = lowerer.lower(intent, DEFAULT_CONTEXT);
    const policyDoc = JSON.parse(resources[0].properties['policy'] as string);
    const actions = policyDoc.Statement[0].Action;
    expect(actions).toContain('xray:PutTraceSegments');
    expect(actions).toContain('xray:PutTelemetryRecords');
    expect(actions).toContain('xray:GetSamplingRules');
    expect(actions).toContain('xray:GetSamplingTargets');
  });

  it('policy name uses target shortName', () => {
    const intent = makeTelemetryIntent({ targetNodeRef: 'component:api-handler' });
    const resources = lowerer.lower(intent, DEFAULT_CONTEXT);
    expect(resources[0].name).toBe('api-handler-xray-policy');
  });

  it('attachment references correct role and policy', () => {
    const intent = makeTelemetryIntent({ targetNodeRef: 'component:api-handler' });
    const resources = lowerer.lower(intent, DEFAULT_CONTEXT);
    const attachment = resources[1];
    expect(attachment.properties['role']).toEqual({ ref: 'api-handler-exec-role' });
    expect(attachment.properties['policyArn']).toEqual({ ref: 'api-handler-xray-policy' });
  });

  it('attachment depends on role and policy', () => {
    const intent = makeTelemetryIntent({ targetNodeRef: 'component:api-handler' });
    const resources = lowerer.lower(intent, DEFAULT_CONTEXT);
    expect(resources[1].dependsOn).toContain('api-handler-exec-role');
    expect(resources[1].dependsOn).toContain('api-handler-xray-policy');
  });

  it('sets sourceId from intent', () => {
    const intent = makeTelemetryIntent({ sourceEdgeId: 'edge:test:a:b' });
    const resources = lowerer.lower(intent, DEFAULT_CONTEXT);
    expect(resources[0].sourceId).toBe('edge:test:a:b');
    expect(resources[1].sourceId).toBe('edge:test:a:b');
  });

  it('sets telemetry tags on policy', () => {
    const intent = makeTelemetryIntent();
    const resources = lowerer.lower(intent, DEFAULT_CONTEXT);
    const tags = resources[0].properties['tags'] as Record<string, string>;
    expect(tags['shinobi:telemetry']).toBe('traces');
    expect(tags['shinobi:target']).toBe('component:handler');
  });

  it('returns empty for non-traces telemetry types', () => {
    const intent = makeTelemetryIntent({ telemetryType: 'metrics' });
    const resources = lowerer.lower(intent, DEFAULT_CONTEXT);
    expect(resources).toHaveLength(0);
  });

  it('returns empty for logs telemetry type', () => {
    const intent = makeTelemetryIntent({ telemetryType: 'logs' });
    const resources = lowerer.lower(intent, DEFAULT_CONTEXT);
    expect(resources).toHaveLength(0);
  });

  it('output is deterministic', () => {
    const intent = makeTelemetryIntent();
    const r1 = lowerer.lower(intent, DEFAULT_CONTEXT);
    const r2 = lowerer.lower(intent, DEFAULT_CONTEXT);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});
