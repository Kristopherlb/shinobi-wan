import type { IamIntent, NetworkIntent, ConfigIntent } from '@shinobi/contracts';
import type { GraphSnapshot, Node, Edge } from '@shinobi/ir';
import { createTestNode, createTestEdge, createSnapshot } from '@shinobi/ir';
import type { LoweringContext, AdapterConfig } from '../types';

export const DEFAULT_ADAPTER_CONFIG: AdapterConfig = {
  region: 'us-east-1',
  serviceName: 'my-lambda-sqs',
};

export function makeNode(overrides: { id: string; type: Node['type'] } & Partial<Node>): Node {
  return createTestNode(overrides);
}

export function makeEdge(
  overrides: { id: string; type: Edge['type']; source: string; target: string } & Partial<Edge>,
): Edge {
  return createTestEdge(overrides);
}

export function makeLambdaSqsSnapshot(): GraphSnapshot {
  const lambda = makeNode({
    id: 'component:api-handler',
    type: 'component',
    metadata: {
      properties: {
        platform: 'aws-lambda',
        runtime: 'nodejs20.x',
        handler: 'index.handler',
        memorySize: 256,
        timeout: 30,
      },
    },
  });

  const sqs = makeNode({
    id: 'platform:work-queue',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-sqs',
        visibilityTimeout: 300,
      },
    },
  });

  const edge = makeEdge({
    id: 'edge:bindsTo:component:api-handler:platform:work-queue',
    type: 'bindsTo',
    source: lambda.id,
    target: sqs.id,
    metadata: {
      bindingConfig: {
        resourceType: 'queue',
        accessLevel: 'write',
        network: { port: 443, protocol: 'tcp' },
        configKeys: [
          { key: 'QUEUE_URL', valueSource: { type: 'reference', nodeRef: 'work-queue', field: 'url' } },
        ],
      },
    },
  });

  return createSnapshot([lambda, sqs], [edge]);
}

export function makeIamIntent(overrides?: Partial<IamIntent>): IamIntent {
  return {
    type: 'iam',
    schemaVersion: '1.0.0',
    sourceEdgeId: 'edge:bindsTo:component:api-handler:platform:work-queue',
    principal: { nodeRef: 'component:api-handler', role: 'function' },
    resource: { nodeRef: 'platform:work-queue', resourceType: 'queue', scope: 'specific' },
    actions: [
      { level: 'write', action: 'read' },
      { level: 'write', action: 'write' },
    ],
    ...overrides,
  };
}

export function makeNetworkIntent(overrides?: Partial<NetworkIntent>): NetworkIntent {
  return {
    type: 'network',
    schemaVersion: '1.0.0',
    sourceEdgeId: 'edge:bindsTo:component:api-handler:platform:work-queue',
    direction: 'egress',
    source: { nodeRef: 'component:api-handler' },
    destination: { nodeRef: 'platform:work-queue', port: 443 },
    protocol: { protocol: 'tcp' },
    ...overrides,
  };
}

export function makeConfigIntent(overrides?: Partial<ConfigIntent>): ConfigIntent {
  return {
    type: 'config',
    schemaVersion: '1.0.0',
    sourceEdgeId: 'edge:bindsTo:component:api-handler:platform:work-queue',
    targetNodeRef: 'component:api-handler',
    key: 'QUEUE_URL',
    valueSource: { type: 'reference', nodeRef: 'work-queue', field: 'url' },
    ...overrides,
  };
}

export function makeContext(overrides?: Partial<LoweringContext>): LoweringContext {
  return {
    intents: [makeIamIntent(), makeNetworkIntent(), makeConfigIntent()],
    snapshot: makeLambdaSqsSnapshot(),
    adapterConfig: DEFAULT_ADAPTER_CONFIG,
    ...overrides,
  };
}
