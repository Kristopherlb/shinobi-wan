import { describe, it, expect } from 'vitest';
import type { IamIntent, NetworkIntent, ConfigIntent } from '@shinobi/contracts';
import type { BindingContext } from '@shinobi/kernel';
import { ComponentPlatformBinder } from '../../binders/component-platform-binder';
import { makeNode, makeEdge } from '../test-helpers';

function makeContext(bindingConfig: Record<string, unknown>): BindingContext {
  const sourceNode = makeNode({ id: 'component:svc-a', type: 'component' });
  const targetNode = makeNode({ id: 'platform:aws-sqs', type: 'platform' });
  const edge = makeEdge({
    id: 'edge:bindsTo:component:svc-a:platform:aws-sqs',
    type: 'bindsTo',
    source: sourceNode.id,
    target: targetNode.id,
    metadata: { bindingConfig },
  });
  return { edge, sourceNode, targetNode, config: {} };
}

describe('ComponentPlatformBinder', () => {
  const binder = new ComponentPlatformBinder();

  describe('identity', () => {
    it('has the correct id', () => {
      expect(binder.id).toBe('component-platform-binder');
    });

    it('supports bindsTo from component to platform', () => {
      expect(binder.supportedEdgeTypes).toEqual([
        { edgeType: 'bindsTo', sourceType: 'component', targetType: 'platform' },
      ]);
    });
  });

  describe('IAM intent emission', () => {
    it('emits IAM intent for read access (default)', () => {
      const ctx = makeContext({ resourceType: 'queue' });
      const result = binder.compileEdge(ctx);

      expect(result.intents).toHaveLength(1);
      const iam = result.intents[0] as IamIntent;
      expect(iam.type).toBe('iam');
      expect(iam.schemaVersion).toBe('1.0.0');
      expect(iam.sourceEdgeId).toBe(ctx.edge.id);
      expect(iam.principal.nodeRef).toBe('component:svc-a');
      expect(iam.principal.role).toBe('component');
      expect(iam.resource.nodeRef).toBe('platform:aws-sqs');
      expect(iam.resource.resourceType).toBe('queue');
      expect(iam.resource.scope).toBe('specific');
      expect(iam.actions).toEqual([{ level: 'read', action: 'read' }]);
    });

    it('emits read + write actions for write access', () => {
      const ctx = makeContext({ resourceType: 'queue', accessLevel: 'write' });
      const result = binder.compileEdge(ctx);

      const iam = result.intents[0] as IamIntent;
      expect(iam.actions).toEqual([
        { level: 'read', action: 'read' },
        { level: 'write', action: 'write' },
      ]);
    });

    it('emits read + write + admin actions for admin access', () => {
      const ctx = makeContext({ resourceType: 'queue', accessLevel: 'admin' });
      const result = binder.compileEdge(ctx);

      const iam = result.intents[0] as IamIntent;
      expect(iam.actions).toEqual([
        { level: 'read', action: 'read' },
        { level: 'write', action: 'write' },
        { level: 'admin', action: 'admin' },
      ]);
    });

    it('defaults to scope:specific when bindingConfig.scope is not set', () => {
      const ctx = makeContext({ resourceType: 'queue' });
      const result = binder.compileEdge(ctx);

      const iam = result.intents[0] as IamIntent;
      expect(iam.resource.scope).toBe('specific');
    });

    it('uses scope:pattern when bindingConfig.scope is pattern', () => {
      const ctx = makeContext({ resourceType: 'queue', scope: 'pattern' });
      const result = binder.compileEdge(ctx);

      const iam = result.intents[0] as IamIntent;
      expect(iam.resource.scope).toBe('pattern');
    });

    it('uses custom actions when provided, overriding access level defaults', () => {
      const ctx = makeContext({
        resourceType: 'bucket',
        accessLevel: 'read',
        actions: ['read', 'list'],
      });
      const result = binder.compileEdge(ctx);

      const iam = result.intents[0] as IamIntent;
      expect(iam.actions).toEqual([
        { level: 'read', action: 'read' },
        { level: 'read', action: 'list' },
      ]);
    });
  });

  describe('network intent emission', () => {
    it('emits network intent when network config is present', () => {
      const ctx = makeContext({
        resourceType: 'queue',
        network: { port: 443, protocol: 'tcp' },
      });
      const result = binder.compileEdge(ctx);

      expect(result.intents).toHaveLength(2);
      const net = result.intents.find((i) => i.type === 'network') as NetworkIntent;
      expect(net).toBeDefined();
      expect(net.direction).toBe('egress');
      expect(net.source.nodeRef).toBe('component:svc-a');
      expect(net.source.port).toBe(443);
      expect(net.destination.nodeRef).toBe('platform:aws-sqs');
      expect(net.destination.port).toBe(443);
      expect(net.protocol.protocol).toBe('tcp');
      expect(net.protocol.ports).toEqual([443]);
    });

    it('defaults to tcp protocol', () => {
      const ctx = makeContext({
        resourceType: 'queue',
        network: { port: 5672 },
      });
      const result = binder.compileEdge(ctx);

      const net = result.intents.find((i) => i.type === 'network') as NetworkIntent;
      expect(net.protocol.protocol).toBe('tcp');
    });

    it('does not emit network intent when network config absent', () => {
      const ctx = makeContext({ resourceType: 'queue' });
      const result = binder.compileEdge(ctx);

      expect(result.intents.every((i) => i.type !== 'network')).toBe(true);
    });
  });

  describe('config intent emission', () => {
    it('emits config intents when configKeys are present', () => {
      const ctx = makeContext({
        resourceType: 'queue',
        configKeys: [
          { key: 'QUEUE_URL', valueSource: { type: 'reference', nodeRef: 'platform:aws-sqs', field: 'url' } },
          { key: 'QUEUE_REGION', valueSource: { type: 'literal', value: 'us-east-1' } },
        ],
      });
      const result = binder.compileEdge(ctx);

      const configs = result.intents.filter((i) => i.type === 'config') as ConfigIntent[];
      expect(configs).toHaveLength(2);
      expect(configs[0].targetNodeRef).toBe('component:svc-a');
      expect(configs[0].key).toBe('QUEUE_URL');
      expect(configs[0].valueSource).toEqual({
        type: 'reference',
        nodeRef: 'platform:aws-sqs',
        field: 'url',
      });
      expect(configs[1].key).toBe('QUEUE_REGION');
      expect(configs[1].valueSource).toEqual({ type: 'literal', value: 'us-east-1' });
    });

    it('does not emit config intents when configKeys absent', () => {
      const ctx = makeContext({ resourceType: 'queue' });
      const result = binder.compileEdge(ctx);

      expect(result.intents.every((i) => i.type !== 'config')).toBe(true);
    });
  });

  describe('diagnostics', () => {
    it('emits error diagnostic when resourceType is missing', () => {
      const ctx = makeContext({});
      const result = binder.compileEdge(ctx);

      expect(result.intents).toHaveLength(0);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].severity).toBe('error');
      expect(result.diagnostics[0].rule).toBe('missing-resource-type');
      expect(result.diagnostics[0].path).toContain('resourceType');
    });

    it('emits warning diagnostic for unknown access level', () => {
      const ctx = makeContext({ resourceType: 'queue', accessLevel: 'superadmin' });
      const result = binder.compileEdge(ctx);

      expect(result.intents).toHaveLength(0);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].severity).toBe('warning');
      expect(result.diagnostics[0].rule).toBe('unknown-access-level');
      expect(result.diagnostics[0].message).toContain('superadmin');
      expect(result.diagnostics[0].message).toContain('read, write, admin');
    });
  });

  describe('determinism', () => {
    it('produces identical output for identical inputs', () => {
      const ctx = makeContext({
        resourceType: 'queue',
        accessLevel: 'write',
        network: { port: 443, protocol: 'tcp' },
        configKeys: [
          { key: 'URL', valueSource: { type: 'literal', value: 'https://sqs' } },
        ],
      });

      const r1 = binder.compileEdge(ctx);
      const r2 = binder.compileEdge(ctx);
      expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
    });
  });

  describe('invariants', () => {
    it('never emits backend handles (no ARNs, no provider IDs)', () => {
      const ctx = makeContext({
        resourceType: 'queue',
        accessLevel: 'admin',
        network: { port: 443 },
        configKeys: [
          { key: 'URL', valueSource: { type: 'literal', value: 'sqs-endpoint' } },
        ],
      });
      const result = binder.compileEdge(ctx);

      const serialized = JSON.stringify(result);
      expect(serialized).not.toMatch(/arn:aws/);
      expect(serialized).not.toMatch(/sg-[a-f0-9]{8}/);
      expect(serialized).not.toMatch(/vpc-[a-f0-9]{8}/);
    });

    it('all intents are frozen', () => {
      const ctx = makeContext({
        resourceType: 'queue',
        network: { port: 443 },
        configKeys: [
          { key: 'URL', valueSource: { type: 'literal', value: 'v' } },
        ],
      });
      const result = binder.compileEdge(ctx);

      for (const intent of result.intents) {
        expect(Object.isFrozen(intent)).toBe(true);
      }
    });
  });
});
