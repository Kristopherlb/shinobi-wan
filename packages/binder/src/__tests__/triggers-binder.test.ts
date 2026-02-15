import { describe, it, expect } from 'vitest';
import type { IamIntent, ConfigIntent } from '@shinobi/contracts';
import type { BindingContext } from '@shinobi/kernel';
import { TriggersBinder } from '../binders/triggers-binder';
import { makeNode, makeEdge } from './test-helpers';

function makeTriggersContext(overrides?: {
  route?: string;
  method?: string;
  resourceType?: string;
  bindingConfig?: Record<string, unknown>;
}): BindingContext {
  const sourceNode = makeNode({
    id: 'platform:api-gw',
    type: 'platform',
    metadata: { properties: { platform: 'aws-apigateway' } },
  });
  const targetNode = makeNode({
    id: 'component:handler',
    type: 'component',
    metadata: { properties: { platform: 'aws-lambda' } },
  });
  const edge = makeEdge({
    id: 'edge:triggers:platform:api-gw:component:handler',
    type: 'triggers',
    source: sourceNode.id,
    target: targetNode.id,
    metadata: {
      bindingConfig: overrides?.bindingConfig ?? {
        resourceType: overrides?.resourceType ?? 'api',
        ...(overrides?.route !== undefined ? { route: overrides.route } : {}),
        ...(overrides?.method !== undefined ? { method: overrides.method } : {}),
      },
    },
  });

  return {
    edge,
    sourceNode,
    targetNode,
    config: {},
  };
}

describe('TriggersBinder', () => {
  const binder = new TriggersBinder();

  it('has id "triggers-binder"', () => {
    expect(binder.id).toBe('triggers-binder');
  });

  it('supports triggers edges from platform to component', () => {
    expect(binder.supportedEdgeTypes).toEqual([
      { edgeType: 'triggers', sourceType: 'platform', targetType: 'component' },
    ]);
  });

  it('emits IAM intent for invoke permission', () => {
    const ctx = makeTriggersContext();
    const result = binder.compileEdge(ctx);

    const iam = result.intents.find((i) => i.type === 'iam') as IamIntent;
    expect(iam).toBeDefined();
    expect(iam.principal.nodeRef).toBe('platform:api-gw');
    expect(iam.resource.nodeRef).toBe('component:handler');
    expect(iam.resource.resourceType).toBe('api');
    expect(iam.actions).toEqual([{ level: 'write', action: 'invoke' }]);
  });

  it('emits config intent for API_GATEWAY_URL', () => {
    const ctx = makeTriggersContext();
    const result = binder.compileEdge(ctx);

    const configs = result.intents.filter((i) => i.type === 'config') as ConfigIntent[];
    const urlConfig = configs.find((c) => c.key === 'API_GATEWAY_URL');
    expect(urlConfig).toBeDefined();
    expect(urlConfig?.targetNodeRef).toBe('component:handler');
    expect(urlConfig?.valueSource).toEqual({
      type: 'reference',
      nodeRef: 'platform:api-gw',
      field: 'url',
    });
  });

  it('emits config intent for API_ROUTE with defaults', () => {
    const ctx = makeTriggersContext();
    const result = binder.compileEdge(ctx);

    const configs = result.intents.filter((i) => i.type === 'config') as ConfigIntent[];
    const routeConfig = configs.find((c) => c.key === 'API_ROUTE');
    expect(routeConfig).toBeDefined();
    expect(routeConfig?.valueSource).toEqual({
      type: 'literal',
      value: 'ANY /',
    });
  });

  it('uses route and method from bindingConfig', () => {
    const ctx = makeTriggersContext({ route: '/items', method: 'GET' });
    const result = binder.compileEdge(ctx);

    const configs = result.intents.filter((i) => i.type === 'config') as ConfigIntent[];
    const routeConfig = configs.find((c) => c.key === 'API_ROUTE');
    expect(routeConfig?.valueSource).toEqual({
      type: 'literal',
      value: 'GET /items',
    });
  });

  it('produces 3 intents total (1 IAM + 2 config)', () => {
    const ctx = makeTriggersContext();
    const result = binder.compileEdge(ctx);

    expect(result.intents).toHaveLength(3);
    expect(result.diagnostics).toHaveLength(0);
  });

  it('returns error diagnostic when resourceType is missing', () => {
    const ctx = makeTriggersContext({ bindingConfig: {} });
    const result = binder.compileEdge(ctx);

    expect(result.intents).toHaveLength(0);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].rule).toBe('missing-resource-type');
    expect(result.diagnostics[0].severity).toBe('error');
  });

  it('intents are frozen (immutable)', () => {
    const ctx = makeTriggersContext();
    const result = binder.compileEdge(ctx);

    for (const intent of result.intents) {
      expect(Object.isFrozen(intent)).toBe(true);
    }
  });

  it('sourceEdgeId matches the edge ID on all intents', () => {
    const ctx = makeTriggersContext();
    const result = binder.compileEdge(ctx);

    for (const intent of result.intents) {
      expect(intent.sourceEdgeId).toBe('edge:triggers:platform:api-gw:component:handler');
    }
  });

  it('all intents have schemaVersion 1.0.0', () => {
    const ctx = makeTriggersContext();
    const result = binder.compileEdge(ctx);

    for (const intent of result.intents) {
      expect(intent.schemaVersion).toBe('1.0.0');
    }
  });
});
