import { describe, it, expect } from 'vitest';
import { ApiGatewayLowerer } from '../lowerers/apigateway-lowerer';
import { makeNode, makeEdge, makeContext, DEFAULT_ADAPTER_CONFIG } from './test-helpers';
import { lower } from '../adapter';
import { createSnapshot } from '@shinobi/ir';
import type { ResolvedDeps, LoweringContext } from '../types';

describe('ApiGatewayLowerer', () => {
  const lowerer = new ApiGatewayLowerer();

  const apiGwNode = makeNode({
    id: 'platform:api-gw',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-apigateway',
      },
    },
  });

  const deps: ResolvedDeps = { envVars: {}, securityGroups: [] };

  it('has platform "aws-apigateway"', () => {
    expect(lowerer.platform).toBe('aws-apigateway');
  });

  it('produces API and Stage resources', () => {
    const resources = lowerer.lower(apiGwNode, makeContext(), deps);

    expect(resources).toHaveLength(2);
    expect(resources[0].resourceType).toBe('aws:apigatewayv2:Api');
    expect(resources[1].resourceType).toBe('aws:apigatewayv2:Stage');
  });

  it('API name includes service name prefix', () => {
    const resources = lowerer.lower(apiGwNode, makeContext(), deps);

    expect(resources[0].properties['name']).toBe('my-lambda-sqs-api-gw');
  });

  it('API has HTTP protocol type', () => {
    const resources = lowerer.lower(apiGwNode, makeContext(), deps);

    expect(resources[0].properties['protocolType']).toBe('HTTP');
  });

  it('stage references the API via ref', () => {
    const resources = lowerer.lower(apiGwNode, makeContext(), deps);

    expect(resources[1].properties['apiId']).toEqual({ ref: 'api-gw-api' });
  });

  it('stage has auto-deploy enabled', () => {
    const resources = lowerer.lower(apiGwNode, makeContext(), deps);

    expect(resources[1].properties['autoDeploy']).toBe(true);
  });

  it('stage uses $default name', () => {
    const resources = lowerer.lower(apiGwNode, makeContext(), deps);

    expect(resources[1].properties['name']).toBe('$default');
  });

  it('stage depends on API resource', () => {
    const resources = lowerer.lower(apiGwNode, makeContext(), deps);

    expect(resources[1].dependsOn).toContain('api-gw-api');
  });

  it('carries shinobi tags on API', () => {
    const resources = lowerer.lower(apiGwNode, makeContext(), deps);

    const tags = resources[0].properties['tags'] as Record<string, string>;
    expect(tags['shinobi:node']).toBe('platform:api-gw');
    expect(tags['shinobi:platform']).toBe('aws-apigateway');
  });

  it('resource names use short name from node ID', () => {
    const resources = lowerer.lower(apiGwNode, makeContext(), deps);

    expect(resources[0].name).toBe('api-gw-api');
    expect(resources[1].name).toBe('api-gw-stage');
  });
});

describe('API Gateway → Lambda integration (adapter)', () => {
  it('generates integration, route, and permission for triggers edges', () => {
    const apiGwNode = makeNode({
      id: 'platform:api-gw',
      type: 'platform',
      metadata: { properties: { platform: 'aws-apigateway' } },
    });
    const lambdaNode = makeNode({
      id: 'component:handler',
      type: 'component',
      metadata: { properties: { platform: 'aws-lambda', runtime: 'nodejs20.x', handler: 'index.handler' } },
    });
    const triggersEdge = makeEdge({
      id: 'edge:triggers:platform:api-gw:component:handler',
      type: 'triggers',
      source: apiGwNode.id,
      target: lambdaNode.id,
      metadata: {
        bindingConfig: {
          resourceType: 'api',
          route: '/items',
          method: 'GET',
        },
      },
    });

    const snapshot = createSnapshot([apiGwNode, lambdaNode], [triggersEdge]);

    const context: LoweringContext = {
      intents: [],
      snapshot,
      adapterConfig: DEFAULT_ADAPTER_CONFIG,
    };

    const result = lower(context);

    // Should have integration, route, and permission resources
    const integration = result.resources.find((r) => r.resourceType === 'aws:apigatewayv2:Integration');
    expect(integration).toBeDefined();
    expect(integration?.properties['integrationType']).toBe('AWS_PROXY');
    expect(integration?.properties['integrationUri']).toEqual({ ref: 'handler-function' });

    const route = result.resources.find((r) => r.resourceType === 'aws:apigatewayv2:Route');
    expect(route).toBeDefined();
    expect(route?.properties['routeKey']).toBe('GET /items');

    const permission = result.resources.find((r) => r.resourceType === 'aws:lambda:Permission');
    expect(permission).toBeDefined();
    expect(permission?.properties['action']).toBe('lambda:InvokeFunction');
    expect(permission?.properties['principal']).toBe('apigateway.amazonaws.com');
  });

  it('defaults route to "ANY /" when no route/method specified', () => {
    const apiGwNode = makeNode({
      id: 'platform:api-gw',
      type: 'platform',
      metadata: { properties: { platform: 'aws-apigateway' } },
    });
    const lambdaNode = makeNode({
      id: 'component:handler',
      type: 'component',
      metadata: { properties: { platform: 'aws-lambda', runtime: 'nodejs20.x', handler: 'index.handler' } },
    });
    const triggersEdge = makeEdge({
      id: 'edge:triggers:platform:api-gw:component:handler',
      type: 'triggers',
      source: apiGwNode.id,
      target: lambdaNode.id,
      metadata: {
        bindingConfig: { resourceType: 'api' },
      },
    });

    const snapshot = createSnapshot([apiGwNode, lambdaNode], [triggersEdge]);
    const result = lower({ intents: [], snapshot, adapterConfig: DEFAULT_ADAPTER_CONFIG });

    const route = result.resources.find((r) => r.resourceType === 'aws:apigatewayv2:Route');
    expect(route?.properties['routeKey']).toBe('$default');
  });

  it('integration depends on API and Lambda function', () => {
    const apiGwNode = makeNode({
      id: 'platform:api-gw',
      type: 'platform',
      metadata: { properties: { platform: 'aws-apigateway' } },
    });
    const lambdaNode = makeNode({
      id: 'component:handler',
      type: 'component',
      metadata: { properties: { platform: 'aws-lambda', runtime: 'nodejs20.x', handler: 'index.handler' } },
    });
    const triggersEdge = makeEdge({
      id: 'edge:triggers:platform:api-gw:component:handler',
      type: 'triggers',
      source: apiGwNode.id,
      target: lambdaNode.id,
      metadata: { bindingConfig: { resourceType: 'api', route: '/items', method: 'GET' } },
    });

    const snapshot = createSnapshot([apiGwNode, lambdaNode], [triggersEdge]);
    const result = lower({ intents: [], snapshot, adapterConfig: DEFAULT_ADAPTER_CONFIG });

    const integration = result.resources.find((r) => r.resourceType === 'aws:apigatewayv2:Integration');
    expect(integration?.dependsOn).toContain('api-gw-api');
    expect(integration?.dependsOn).toContain('handler-function');
  });
});
