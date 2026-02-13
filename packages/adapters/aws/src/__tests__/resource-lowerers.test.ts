import { describe, it, expect } from 'vitest';
import { LambdaLowerer } from '../lowerers/lambda-lowerer';
import { SqsLowerer } from '../lowerers/sqs-lowerer';
import { makeNode, makeContext, DEFAULT_ADAPTER_CONFIG } from './test-helpers';
import type { ResolvedDeps } from '../types';

describe('LambdaLowerer', () => {
  const lowerer = new LambdaLowerer();

  const lambdaNode = makeNode({
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

  const deps: ResolvedDeps = {
    roleName: 'api-handler-exec-role',
    envVars: { QUEUE_URL: { ref: 'work-queue-queue.url' } },
    securityGroups: [],
  };

  it('produces a Lambda Function resource', () => {
    const resources = lowerer.lower(lambdaNode, makeContext(), deps);

    expect(resources).toHaveLength(1);
    expect(resources[0].resourceType).toBe('aws:lambda:Function');
  });

  it('function name includes service name prefix', () => {
    const resources = lowerer.lower(lambdaNode, makeContext(), deps);

    expect(resources[0].properties['functionName']).toBe('my-lambda-sqs-api-handler');
  });

  it('passes through runtime, handler, memorySize, timeout', () => {
    const resources = lowerer.lower(lambdaNode, makeContext(), deps);

    expect(resources[0].properties['runtime']).toBe('nodejs20.x');
    expect(resources[0].properties['handler']).toBe('index.handler');
    expect(resources[0].properties['memorySize']).toBe(256);
    expect(resources[0].properties['timeout']).toBe(30);
  });

  it('references IAM role from resolved deps', () => {
    const resources = lowerer.lower(lambdaNode, makeContext(), deps);

    expect(resources[0].properties['role']).toEqual({ ref: 'api-handler-exec-role' });
    expect(resources[0].dependsOn).toContain('api-handler-exec-role');
  });

  it('includes environment variables from resolved deps', () => {
    const resources = lowerer.lower(lambdaNode, makeContext(), deps);

    const env = resources[0].properties['environment'] as Record<string, unknown>;
    expect(env['variables']).toEqual({ QUEUE_URL: { ref: 'work-queue-queue.url' } });
  });

  it('omits environment when no env vars', () => {
    const noDeps: ResolvedDeps = { envVars: {}, securityGroups: [] };
    const resources = lowerer.lower(lambdaNode, makeContext(), noDeps);

    expect(resources[0].properties['environment']).toBeUndefined();
  });

  it('includes code path when configured', () => {
    const ctx = makeContext({
      adapterConfig: { ...DEFAULT_ADAPTER_CONFIG, codePath: './dist/handler.zip' },
    });
    const resources = lowerer.lower(lambdaNode, ctx, deps);

    expect(resources[0].properties['code']).toEqual({ path: './dist/handler.zip' });
  });

  it('carries shinobi tags', () => {
    const resources = lowerer.lower(lambdaNode, makeContext(), deps);

    const tags = resources[0].properties['tags'] as Record<string, string>;
    expect(tags['shinobi:node']).toBe('component:api-handler');
    expect(tags['shinobi:platform']).toBe('aws-lambda');
  });
});

describe('SqsLowerer', () => {
  const lowerer = new SqsLowerer();

  const sqsNode = makeNode({
    id: 'platform:work-queue',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-sqs',
        visibilityTimeout: 300,
      },
    },
  });

  const deps: ResolvedDeps = { envVars: {}, securityGroups: [] };

  it('produces an SQS Queue resource', () => {
    const resources = lowerer.lower(sqsNode, makeContext(), deps);

    expect(resources).toHaveLength(1);
    expect(resources[0].resourceType).toBe('aws:sqs:Queue');
  });

  it('queue name includes service name prefix', () => {
    const resources = lowerer.lower(sqsNode, makeContext(), deps);

    expect(resources[0].properties['name']).toBe('my-lambda-sqs-work-queue');
  });

  it('uses visibility timeout from node properties', () => {
    const resources = lowerer.lower(sqsNode, makeContext(), deps);

    expect(resources[0].properties['visibilityTimeoutSeconds']).toBe(300);
  });

  it('uses default visibility timeout when not specified', () => {
    const node = makeNode({
      id: 'platform:basic-queue',
      type: 'platform',
      metadata: { properties: { platform: 'aws-sqs' } },
    });
    const resources = lowerer.lower(node, makeContext(), deps);

    expect(resources[0].properties['visibilityTimeoutSeconds']).toBe(30);
  });

  it('carries shinobi tags', () => {
    const resources = lowerer.lower(sqsNode, makeContext(), deps);

    const tags = resources[0].properties['tags'] as Record<string, string>;
    expect(tags['shinobi:node']).toBe('platform:work-queue');
    expect(tags['shinobi:platform']).toBe('aws-sqs');
  });
});
