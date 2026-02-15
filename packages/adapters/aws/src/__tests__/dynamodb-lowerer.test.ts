import { describe, it, expect } from 'vitest';
import { DynamoDbLowerer } from '../lowerers/dynamodb-lowerer';
import { makeNode, makeContext } from './test-helpers';
import type { ResolvedDeps } from '../types';

describe('DynamoDbLowerer', () => {
  const lowerer = new DynamoDbLowerer();

  const dynamoNode = makeNode({
    id: 'platform:data-table',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-dynamodb',
        keySchema: {
          hashKey: { name: 'pk', type: 'S' },
          rangeKey: { name: 'sk', type: 'S' },
        },
      },
    },
  });

  const deps: ResolvedDeps = { envVars: {}, securityGroups: [] };

  it('has platform "aws-dynamodb"', () => {
    expect(lowerer.platform).toBe('aws-dynamodb');
  });

  it('produces a DynamoDB Table resource', () => {
    const resources = lowerer.lower(dynamoNode, makeContext(), deps);

    expect(resources).toHaveLength(1);
    expect(resources[0].resourceType).toBe('aws:dynamodb:Table');
  });

  it('table name includes service name prefix', () => {
    const resources = lowerer.lower(dynamoNode, makeContext(), deps);

    expect(resources[0].properties['name']).toBe('my-lambda-sqs-data-table');
  });

  it('uses hash key from keySchema', () => {
    const resources = lowerer.lower(dynamoNode, makeContext(), deps);

    expect(resources[0].properties['hashKey']).toBe('pk');
  });

  it('uses range key from keySchema when present', () => {
    const resources = lowerer.lower(dynamoNode, makeContext(), deps);

    expect(resources[0].properties['rangeKey']).toBe('sk');
  });

  it('includes attribute definitions for hash and range keys', () => {
    const resources = lowerer.lower(dynamoNode, makeContext(), deps);

    const attrs = resources[0].properties['attributes'] as Array<{ name: string; type: string }>;
    expect(attrs).toEqual([
      { name: 'pk', type: 'S' },
      { name: 'sk', type: 'S' },
    ]);
  });

  it('defaults to PAY_PER_REQUEST billing mode', () => {
    const resources = lowerer.lower(dynamoNode, makeContext(), deps);

    expect(resources[0].properties['billingMode']).toBe('PAY_PER_REQUEST');
  });

  it('uses configured billing mode when specified', () => {
    const node = makeNode({
      id: 'platform:provisioned-table',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-dynamodb',
          billingMode: 'PROVISIONED',
          keySchema: { hashKey: { name: 'id', type: 'S' } },
        },
      },
    });
    const resources = lowerer.lower(node, makeContext(), deps);

    expect(resources[0].properties['billingMode']).toBe('PROVISIONED');
  });

  it('defaults hash key to "id" with type "S" when no keySchema', () => {
    const node = makeNode({
      id: 'platform:simple-table',
      type: 'platform',
      metadata: { properties: { platform: 'aws-dynamodb' } },
    });
    const resources = lowerer.lower(node, makeContext(), deps);

    expect(resources[0].properties['hashKey']).toBe('id');
    const attrs = resources[0].properties['attributes'] as Array<{ name: string; type: string }>;
    expect(attrs).toEqual([{ name: 'id', type: 'S' }]);
  });

  it('omits rangeKey when not specified in keySchema', () => {
    const node = makeNode({
      id: 'platform:hash-only',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-dynamodb',
          keySchema: { hashKey: { name: 'pk', type: 'S' } },
        },
      },
    });
    const resources = lowerer.lower(node, makeContext(), deps);

    expect(resources[0].properties['rangeKey']).toBeUndefined();
    const attrs = resources[0].properties['attributes'] as Array<{ name: string; type: string }>;
    expect(attrs).toHaveLength(1);
  });

  it('carries shinobi tags', () => {
    const resources = lowerer.lower(dynamoNode, makeContext(), deps);

    const tags = resources[0].properties['tags'] as Record<string, string>;
    expect(tags['shinobi:node']).toBe('platform:data-table');
    expect(tags['shinobi:platform']).toBe('aws-dynamodb');
  });
});
