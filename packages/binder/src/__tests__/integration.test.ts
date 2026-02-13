import { describe, it, expect } from 'vitest';
import type { IamIntent, NetworkIntent, ConfigIntent } from '@shinobi/contracts';
import { Kernel } from '@shinobi/kernel';
import { ComponentPlatformBinder } from '../binders/component-platform-binder';
import { BinderRegistry } from '../registry';
import { makeNode, makeEdge } from './test-helpers';

describe('Kernel + ComponentPlatformBinder integration', () => {
  function createKernelWithBinder() {
    const registry = new BinderRegistry();
    registry.register(new ComponentPlatformBinder());

    return new Kernel({
      binders: registry.getBinders(),
    });
  }

  function addComponentPlatformGraph(kernel: ReturnType<typeof createKernelWithBinder>) {
    const sourceNode = makeNode({ id: 'component:my-svc', type: 'component' });
    const targetNode = makeNode({ id: 'platform:aws-sqs', type: 'platform' });
    const edge = makeEdge({
      id: 'edge:bindsTo:component:my-svc:platform:aws-sqs',
      type: 'bindsTo',
      source: sourceNode.id,
      target: targetNode.id,
      metadata: {
        bindingConfig: {
          resourceType: 'queue',
          accessLevel: 'write',
          network: { port: 443, protocol: 'tcp' },
          configKeys: [
            {
              key: 'QUEUE_URL',
              valueSource: {
                type: 'reference',
                nodeRef: 'platform:aws-sqs',
                field: 'url',
              },
            },
          ],
        },
      },
    });

    kernel.applyMutation([
      { type: 'addNode', node: sourceNode },
      { type: 'addNode', node: targetNode },
      { type: 'addEdge', edge },
    ]);

    return { sourceNode, targetNode, edge };
  }

  it('compiles a graph with ComponentPlatformBinder producing valid intents', () => {
    const kernel = createKernelWithBinder();
    const { edge } = addComponentPlatformGraph(kernel);

    const result = kernel.compile();

    expect(result.validation.valid).toBe(true);
    // IAM + network + config = 3 intents
    expect(result.intents).toHaveLength(3);

    // Verify IAM intent
    const iam = result.intents.find((i) => i.type === 'iam') as IamIntent;
    expect(iam).toBeDefined();
    expect(iam.sourceEdgeId).toBe(edge.id);
    expect(iam.principal.nodeRef).toBe('component:my-svc');
    expect(iam.resource.nodeRef).toBe('platform:aws-sqs');
    expect(iam.resource.resourceType).toBe('queue');
    expect(iam.actions).toEqual([
      { level: 'read', action: 'read' },
      { level: 'write', action: 'write' },
    ]);

    // Verify network intent
    const net = result.intents.find((i) => i.type === 'network') as NetworkIntent;
    expect(net).toBeDefined();
    expect(net.direction).toBe('egress');
    expect(net.source.nodeRef).toBe('component:my-svc');
    expect(net.destination.nodeRef).toBe('platform:aws-sqs');

    // Verify config intent
    const cfg = result.intents.find((i) => i.type === 'config') as ConfigIntent;
    expect(cfg).toBeDefined();
    expect(cfg.targetNodeRef).toBe('component:my-svc');
    expect(cfg.key).toBe('QUEUE_URL');
  });

  it('intents are sorted deterministically by (type, sourceEdgeId)', () => {
    const kernel = createKernelWithBinder();
    addComponentPlatformGraph(kernel);

    const result = kernel.compile();

    // Sorted by type: config < iam < network
    const types = result.intents.map((i) => i.type);
    const sortedTypes = [...types].sort();
    expect(types).toEqual(sortedTypes);
  });

  it('result snapshot is frozen', () => {
    const kernel = createKernelWithBinder();
    addComponentPlatformGraph(kernel);

    const result = kernel.compile();

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.snapshot)).toBe(true);
    expect(Object.isFrozen(result.intents)).toBe(true);
  });

  it('produces deterministic output for identical inputs', () => {
    const k1 = createKernelWithBinder();
    addComponentPlatformGraph(k1);
    const r1 = k1.compile();

    const k2 = createKernelWithBinder();
    addComponentPlatformGraph(k2);
    const r2 = k2.compile();

    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it('produces unbound-edge diagnostic for edges with no matching binder', () => {
    const kernel = createKernelWithBinder();

    const n1 = makeNode({ id: 'component:a', type: 'component' });
    const n2 = makeNode({ id: 'component:b', type: 'component' });
    const unboundEdge = makeEdge({
      id: 'edge:triggers:component:a:component:b',
      type: 'triggers',
      source: n1.id,
      target: n2.id,
    });

    kernel.applyMutation([
      { type: 'addNode', node: n1 },
      { type: 'addNode', node: n2 },
      { type: 'addEdge', edge: unboundEdge },
    ]);

    const result = kernel.compile();

    const unboundDiag = result.bindingDiagnostics.find(
      (d) => d.rule === 'unbound-edge'
    );
    expect(unboundDiag).toBeDefined();
    expect(unboundDiag?.severity).toBe('warning');
    expect(unboundDiag?.message).toContain('triggers');
  });

  it('propagates binding diagnostics from the binder', () => {
    const kernel = createKernelWithBinder();

    const source = makeNode({ id: 'component:svc', type: 'component' });
    const target = makeNode({ id: 'platform:db', type: 'platform' });
    const edge = makeEdge({
      id: 'edge:bindsTo:component:svc:platform:db',
      type: 'bindsTo',
      source: source.id,
      target: target.id,
      metadata: {
        bindingConfig: {
          // Missing resourceType → error diagnostic
        },
      },
    });

    kernel.applyMutation([
      { type: 'addNode', node: source },
      { type: 'addNode', node: target },
      { type: 'addEdge', edge },
    ]);

    const result = kernel.compile();

    const diag = result.bindingDiagnostics.find(
      (d) => d.rule === 'missing-resource-type'
    );
    expect(diag).toBeDefined();
    expect(diag?.severity).toBe('error');
  });

  it('BinderRegistry can be used to compose multiple binder sets', () => {
    const registry = new BinderRegistry();
    registry.register(new ComponentPlatformBinder());

    const binders = registry.getBinders();
    expect(binders).toHaveLength(1);
    expect(binders[0].id).toBe('component-platform-binder');

    // Verify lookup works
    const found = registry.findBinder('bindsTo', 'component', 'platform');
    expect(found).toBeDefined();
    expect(found?.id).toBe('component-platform-binder');
  });
});
