import { describe, it, expect } from 'vitest';
import {
  createIamIntent,
  createNetworkIntent,
  createConfigIntent,
  createTelemetryIntent,
} from '../intent-factories';

describe('intent-factories', () => {
  const edgeId = 'edge:bindsTo:component:svc-a:platform:aws-lambda';

  describe('createIamIntent', () => {
    it('creates a valid IAM intent with schemaVersion and sourceEdgeId', () => {
      const intent = createIamIntent(
        edgeId,
        { nodeRef: 'component:svc-a', role: 'service' },
        { nodeRef: 'platform:aws-lambda', resourceType: 'function', scope: 'specific' },
        [{ level: 'read', action: 'read' }]
      );

      expect(intent.type).toBe('iam');
      expect(intent.schemaVersion).toBe('1.0.0');
      expect(intent.sourceEdgeId).toBe(edgeId);
      expect(intent.principal.nodeRef).toBe('component:svc-a');
      expect(intent.resource.resourceType).toBe('function');
      expect(intent.actions).toHaveLength(1);
    });

    it('includes conditions when provided', () => {
      const intent = createIamIntent(
        edgeId,
        { nodeRef: 'component:svc-a', role: 'service' },
        { nodeRef: 'platform:aws-lambda', resourceType: 'function', scope: 'specific' },
        [{ level: 'read', action: 'read' }],
        [{ key: 'env', operator: 'equals', value: 'production' }]
      );

      expect(intent.conditions).toHaveLength(1);
      expect(intent.conditions?.[0].key).toBe('env');
    });

    it('omits conditions when not provided', () => {
      const intent = createIamIntent(
        edgeId,
        { nodeRef: 'component:svc-a', role: 'service' },
        { nodeRef: 'platform:aws-lambda', resourceType: 'function', scope: 'specific' },
        [{ level: 'read', action: 'read' }]
      );

      expect(intent.conditions).toBeUndefined();
    });

    it('returns a frozen object', () => {
      const intent = createIamIntent(
        edgeId,
        { nodeRef: 'component:svc-a', role: 'service' },
        { nodeRef: 'platform:aws-lambda', resourceType: 'function', scope: 'specific' },
        [{ level: 'read', action: 'read' }]
      );

      expect(Object.isFrozen(intent)).toBe(true);
      expect(Object.isFrozen(intent.principal)).toBe(true);
      expect(Object.isFrozen(intent.resource)).toBe(true);
      expect(Object.isFrozen(intent.actions)).toBe(true);
    });
  });

  describe('createNetworkIntent', () => {
    it('creates a valid network intent', () => {
      const intent = createNetworkIntent(
        edgeId,
        'egress',
        { nodeRef: 'component:svc-a', port: 443 },
        { nodeRef: 'platform:aws-lambda', port: 443 },
        { protocol: 'tcp', ports: [443] }
      );

      expect(intent.type).toBe('network');
      expect(intent.schemaVersion).toBe('1.0.0');
      expect(intent.sourceEdgeId).toBe(edgeId);
      expect(intent.direction).toBe('egress');
      expect(intent.source.nodeRef).toBe('component:svc-a');
      expect(intent.destination.nodeRef).toBe('platform:aws-lambda');
      expect(intent.protocol.protocol).toBe('tcp');
    });

    it('returns a frozen object', () => {
      const intent = createNetworkIntent(
        edgeId,
        'egress',
        { nodeRef: 'component:svc-a' },
        { nodeRef: 'platform:aws-lambda' },
        { protocol: 'tcp' }
      );

      expect(Object.isFrozen(intent)).toBe(true);
      expect(Object.isFrozen(intent.source)).toBe(true);
      expect(Object.isFrozen(intent.destination)).toBe(true);
    });
  });

  describe('createConfigIntent', () => {
    it('creates a valid config intent with literal value', () => {
      const intent = createConfigIntent(
        edgeId,
        'component:svc-a',
        'DB_HOST',
        { type: 'literal', value: 'localhost' }
      );

      expect(intent.type).toBe('config');
      expect(intent.schemaVersion).toBe('1.0.0');
      expect(intent.sourceEdgeId).toBe(edgeId);
      expect(intent.targetNodeRef).toBe('component:svc-a');
      expect(intent.key).toBe('DB_HOST');
      expect(intent.valueSource).toEqual({ type: 'literal', value: 'localhost' });
    });

    it('creates a valid config intent with reference value', () => {
      const intent = createConfigIntent(
        edgeId,
        'component:svc-a',
        'QUEUE_URL',
        { type: 'reference', nodeRef: 'platform:sqs', field: 'url' }
      );

      expect(intent.valueSource).toEqual({
        type: 'reference',
        nodeRef: 'platform:sqs',
        field: 'url',
      });
    });

    it('creates a valid config intent with secret value', () => {
      const intent = createConfigIntent(
        edgeId,
        'component:svc-a',
        'API_KEY',
        { type: 'secret', secretRef: 'secret:api-key' }
      );

      expect(intent.valueSource).toEqual({
        type: 'secret',
        secretRef: 'secret:api-key',
      });
    });

    it('returns a frozen object', () => {
      const intent = createConfigIntent(
        edgeId,
        'component:svc-a',
        'KEY',
        { type: 'literal', value: 'val' }
      );

      expect(Object.isFrozen(intent)).toBe(true);
      expect(Object.isFrozen(intent.valueSource)).toBe(true);
    });
  });

  describe('createTelemetryIntent', () => {
    it('creates a valid telemetry intent', () => {
      const intent = createTelemetryIntent(
        edgeId,
        'component:svc-a',
        'metrics',
        { enabled: true, samplingRate: 0.5 }
      );

      expect(intent.type).toBe('telemetry');
      expect(intent.schemaVersion).toBe('1.0.0');
      expect(intent.sourceEdgeId).toBe(edgeId);
      expect(intent.targetNodeRef).toBe('component:svc-a');
      expect(intent.telemetryType).toBe('metrics');
      expect(intent.config.enabled).toBe(true);
      expect(intent.config.samplingRate).toBe(0.5);
    });

    it('returns a frozen object', () => {
      const intent = createTelemetryIntent(
        edgeId,
        'component:svc-a',
        'logs',
        { enabled: true }
      );

      expect(Object.isFrozen(intent)).toBe(true);
      expect(Object.isFrozen(intent.config)).toBe(true);
    });
  });

  describe('cross-cutting concerns', () => {
    it('all factories enforce schemaVersion 1.0.0', () => {
      const iam = createIamIntent(
        edgeId,
        { nodeRef: 'n1', role: 'service' },
        { nodeRef: 'n2', resourceType: 'bucket', scope: 'specific' },
        [{ level: 'read', action: 'read' }]
      );
      const net = createNetworkIntent(
        edgeId,
        'egress',
        { nodeRef: 'n1' },
        { nodeRef: 'n2' },
        { protocol: 'tcp' }
      );
      const cfg = createConfigIntent(
        edgeId,
        'n1',
        'KEY',
        { type: 'literal', value: 'v' }
      );
      const tel = createTelemetryIntent(
        edgeId,
        'n1',
        'traces',
        { enabled: true }
      );

      expect(iam.schemaVersion).toBe('1.0.0');
      expect(net.schemaVersion).toBe('1.0.0');
      expect(cfg.schemaVersion).toBe('1.0.0');
      expect(tel.schemaVersion).toBe('1.0.0');
    });

    it('all factories propagate sourceEdgeId', () => {
      const customEdgeId = 'edge:dependsOn:component:x:platform:y';
      const iam = createIamIntent(
        customEdgeId,
        { nodeRef: 'n1', role: 'service' },
        { nodeRef: 'n2', resourceType: 'bucket', scope: 'specific' },
        [{ level: 'read', action: 'read' }]
      );
      const net = createNetworkIntent(
        customEdgeId,
        'ingress',
        { nodeRef: 'n1' },
        { nodeRef: 'n2' },
        { protocol: 'udp' }
      );
      const cfg = createConfigIntent(
        customEdgeId,
        'n1',
        'KEY',
        { type: 'literal', value: 'v' }
      );
      const tel = createTelemetryIntent(
        customEdgeId,
        'n1',
        'logs',
        { enabled: false }
      );

      expect(iam.sourceEdgeId).toBe(customEdgeId);
      expect(net.sourceEdgeId).toBe(customEdgeId);
      expect(cfg.sourceEdgeId).toBe(customEdgeId);
      expect(tel.sourceEdgeId).toBe(customEdgeId);
    });
  });
});
