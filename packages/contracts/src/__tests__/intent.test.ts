import { describe, it, expect } from 'vitest';
import {
  INTENT_TYPES,
  type Intent,
  type IntentType,
  type IamIntent,
  type IamPrincipal,
  type IamResource,
  type IamAction,
  type IamCondition,
  type NetworkIntent,
  type NetworkEndpoint,
  type NetworkProtocol,
  type ConfigIntent,
  type ConfigValueSource,
  type TelemetryIntent,
  type TelemetryConfig,
} from '../intent/index';
import { CONTRACT_SCHEMA_VERSION } from '../versions';

describe('Intent base', () => {
  it('defines intent types', () => {
    expect(INTENT_TYPES).toEqual(['iam', 'network', 'config', 'telemetry']);
  });

  it('has base fields: type, schemaVersion, sourceEdgeId', () => {
    const intent: Intent = {
      type: 'iam',
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      sourceEdgeId: 'edge:bindsTo:component:a:capability:b',
    };

    expect(intent.type).toBe('iam');
    expect(intent.schemaVersion).toBe('1.0.0');
    expect(intent.sourceEdgeId).toContain('edge:');
  });
});

describe('IamIntent', () => {
  it('represents backend-neutral IAM permissions', () => {
    const intent: IamIntent = {
      type: 'iam',
      schemaVersion: '1.0.0',
      sourceEdgeId: 'edge:bindsTo:component:api:capability:queue',
      principal: {
        nodeRef: 'component:api',
        role: 'service',
      },
      resource: {
        nodeRef: 'capability:queue',
        resourceType: 'queue',
        scope: 'specific',
      },
      actions: [
        { level: 'write', action: 'sendMessage' },
        { level: 'read', action: 'receiveMessage' },
      ],
    };

    expect(intent.type).toBe('iam');
    expect(intent.principal.nodeRef).toBe('component:api');
    expect(intent.resource.resourceType).toBe('queue');
    expect(intent.actions).toHaveLength(2);
  });

  it('supports conditions for scoped access', () => {
    const intent: IamIntent = {
      type: 'iam',
      schemaVersion: '1.0.0',
      sourceEdgeId: 'edge:bindsTo:a:b',
      principal: { nodeRef: 'a', role: 'function' },
      resource: { nodeRef: 'b', resourceType: 'bucket', scope: 'specific' },
      actions: [{ level: 'read', action: 'getObject' }],
      conditions: [
        { key: 'prefix', operator: 'startsWith', value: 'uploads/' },
      ],
    };

    expect(intent.conditions).toHaveLength(1);
    expect(intent.conditions![0].operator).toBe('startsWith');
  });

  it('has no provider-specific fields (backend-neutral)', () => {
    const intent: IamIntent = {
      type: 'iam',
      schemaVersion: '1.0.0',
      sourceEdgeId: 'edge:x',
      principal: { nodeRef: 'a', role: 'service' },
      resource: { nodeRef: 'b', resourceType: 'table', scope: 'specific' },
      actions: [{ level: 'read', action: 'query' }],
    };

    // Verify no AWS/GCP/Azure specific fields
    expect(intent).not.toHaveProperty('policyArn');
    expect(intent).not.toHaveProperty('iamRoleArn');
    expect(intent.resource).not.toHaveProperty('arn');
  });
});

describe('NetworkIntent', () => {
  it('represents backend-neutral network rules', () => {
    const intent: NetworkIntent = {
      type: 'network',
      schemaVersion: '1.0.0',
      sourceEdgeId: 'edge:triggers:component:web:component:api',
      direction: 'egress',
      source: { nodeRef: 'component:web', port: 443 },
      destination: { nodeRef: 'component:api', port: 8080 },
      protocol: { protocol: 'tcp', ports: [8080] },
    };

    expect(intent.type).toBe('network');
    expect(intent.direction).toBe('egress');
    expect(intent.source.port).toBe(443);
    expect(intent.destination.port).toBe(8080);
  });

  it('supports port ranges', () => {
    const endpoint: NetworkEndpoint = {
      nodeRef: 'component:db',
      portRange: { from: 5432, to: 5433 },
    };

    expect(endpoint.portRange?.from).toBe(5432);
    expect(endpoint.portRange?.to).toBe(5433);
  });

  it('supports protocol types', () => {
    const tcp: NetworkProtocol = { protocol: 'tcp', ports: [80, 443] };
    const udp: NetworkProtocol = { protocol: 'udp', ports: [53] };
    const any: NetworkProtocol = { protocol: 'any' };

    expect(tcp.protocol).toBe('tcp');
    expect(udp.protocol).toBe('udp');
    expect(any.protocol).toBe('any');
  });
});

describe('ConfigIntent', () => {
  it('represents runtime configuration', () => {
    const intent: ConfigIntent = {
      type: 'config',
      schemaVersion: '1.0.0',
      sourceEdgeId: 'edge:bindsTo:a:b',
      targetNodeRef: 'component:api',
      key: 'DATABASE_URL',
      valueSource: { type: 'reference', nodeRef: 'component:db', field: 'connectionUrl' },
    };

    expect(intent.type).toBe('config');
    expect(intent.key).toBe('DATABASE_URL');
    expect(intent.valueSource.type).toBe('reference');
  });

  it('supports literal values', () => {
    const source: ConfigValueSource = { type: 'literal', value: 8080 };
    expect(source.type).toBe('literal');
    expect((source as { type: 'literal'; value: number }).value).toBe(8080);
  });

  it('supports secret references', () => {
    const source: ConfigValueSource = { type: 'secret', secretRef: 'secret:api-key' };
    expect(source.type).toBe('secret');
  });
});

describe('TelemetryIntent', () => {
  it('represents observability configuration', () => {
    const intent: TelemetryIntent = {
      type: 'telemetry',
      schemaVersion: '1.0.0',
      sourceEdgeId: 'edge:x',
      targetNodeRef: 'component:api',
      telemetryType: 'traces',
      config: {
        enabled: true,
        samplingRate: 0.1,
        destination: 'otel-collector',
      },
    };

    expect(intent.type).toBe('telemetry');
    expect(intent.telemetryType).toBe('traces');
    expect(intent.config.samplingRate).toBe(0.1);
  });

  it('supports metrics, traces, and logs', () => {
    const types: Array<'metrics' | 'traces' | 'logs'> = ['metrics', 'traces', 'logs'];

    types.forEach((telemetryType) => {
      const intent: TelemetryIntent = {
        type: 'telemetry',
        schemaVersion: '1.0.0',
        sourceEdgeId: 'edge:x',
        targetNodeRef: 'component:y',
        telemetryType,
        config: { enabled: true },
      };
      expect(intent.telemetryType).toBe(telemetryType);
    });
  });
});
