import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ResourcePlan, PlannedResource } from '../program-generator';
import type { AdapterConfig } from '../types';

// Track all constructed resources
const constructedResources: Array<{ type: string; name: string; args: Record<string, unknown>; opts?: unknown }> = [];

function makeMockResource(type: string, name: string, args: Record<string, unknown>) {
  const resource = {
    __type: type,
    __name: name,
    __args: args,
    arn: { apply: vi.fn((fn: (v: string) => unknown) => fn(`arn:aws:mock:us-east-1:123456789012:${name}`)), value: `arn:aws:mock:us-east-1:123456789012:${name}` },
    name: { apply: vi.fn((fn: (v: string) => unknown) => fn(name)), value: name },
    url: { apply: vi.fn((fn: (v: string) => unknown) => fn(`https://sqs.us-east-1.amazonaws.com/123456789012/${name}`)), value: `https://sqs.us-east-1.amazonaws.com/123456789012/${name}` },
    functionName: { apply: vi.fn((fn: (v: string) => unknown) => fn(name)), value: name },
    id: { apply: vi.fn((fn: (v: string) => unknown) => fn(`id-${name}`)), value: `id-${name}` },
  };
  constructedResources.push({ type, name, args });
  return resource;
}

// Mock @pulumi/pulumi — no top-level variable references in factory
vi.mock('@pulumi/pulumi', () => ({
  output: (val: unknown) => ({
    apply: (fn: (v: unknown) => unknown) => fn(val),
    value: val,
  }),
  log: { warn: vi.fn() },
}));

// Mock @pulumi/aws — constructors must be real functions (not arrows) to support `new`
vi.mock('@pulumi/aws', () => {
  function makeConstructor(type: string) {
    // Use a regular function so it's constructable with `new`
    const Ctor = function (this: Record<string, unknown>, name: string, args: Record<string, unknown>) {
      const mock = makeMockResource(type, name, args);
      Object.assign(this, mock);
    } as unknown as new (name: string, args: Record<string, unknown>, opts?: unknown) => Record<string, unknown>;
    return Ctor;
  }

  return {
    iam: {
      Role: makeConstructor('aws:iam:Role'),
      Policy: makeConstructor('aws:iam:Policy'),
      RolePolicyAttachment: makeConstructor('aws:iam:RolePolicyAttachment'),
    },
    lambda: {
      Function: makeConstructor('aws:lambda:Function'),
      EventSourceMapping: makeConstructor('aws:lambda:EventSourceMapping'),
      Permission: makeConstructor('aws:lambda:Permission'),
    },
    sqs: {
      Queue: makeConstructor('aws:sqs:Queue'),
    },
    ssm: {
      Parameter: makeConstructor('aws:ssm:Parameter'),
    },
    ec2: {
      SecurityGroupRule: makeConstructor('aws:ec2:SecurityGroupRule'),
    },
    dynamodb: {
      Table: makeConstructor('aws:dynamodb:Table'),
    },
    s3: {
      Bucket: makeConstructor('aws:s3:Bucket'),
      BucketVersioningV2: makeConstructor('aws:s3:BucketVersioningV2'),
    },
    apigatewayv2: {
      Api: makeConstructor('aws:apigatewayv2:Api'),
      Stage: makeConstructor('aws:apigatewayv2:Stage'),
      Integration: makeConstructor('aws:apigatewayv2:Integration'),
      Route: makeConstructor('aws:apigatewayv2:Route'),
    },
    sns: {
      Topic: makeConstructor('aws:sns:Topic'),
    },
  };
});

// Import after mocks
import { createPulumiProgram } from '../pulumi-program';
import * as pulumi from '@pulumi/pulumi';

const DEFAULT_CONFIG: AdapterConfig = {
  region: 'us-east-1',
  serviceName: 'test-service',
};

function makePlannedResource(overrides: Partial<PlannedResource> & { name: string; resourceType: string }): PlannedResource {
  return {
    properties: {},
    dependsOn: [],
    ...overrides,
  };
}

function makePlan(resources: PlannedResource[], outputs?: Record<string, string>): ResourcePlan {
  return {
    resources,
    outputs: outputs ?? {},
  };
}

describe('createPulumiProgram', () => {
  beforeEach(() => {
    constructedResources.length = 0;
    vi.mocked(pulumi.log.warn).mockClear();
  });

  it('returns a function', () => {
    const plan = makePlan([]);
    const fn = createPulumiProgram(plan, DEFAULT_CONFIG);
    expect(typeof fn).toBe('function');
  });

  it('creates resources in order', async () => {
    const plan = makePlan([
      makePlannedResource({
        name: 'my-role',
        resourceType: 'aws:iam:Role',
        properties: {
          assumeRolePolicy: '{}',
        },
      }),
      makePlannedResource({
        name: 'my-function',
        resourceType: 'aws:lambda:Function',
        properties: {
          functionName: 'test-fn',
          runtime: 'nodejs20.x',
          handler: 'index.handler',
          role: { ref: 'my-role' },
        },
        dependsOn: ['my-role'],
      }),
    ]);

    const fn = createPulumiProgram(plan, DEFAULT_CONFIG);
    await fn();

    expect(constructedResources).toHaveLength(2);
    expect(constructedResources[0]?.type).toBe('aws:iam:Role');
    expect(constructedResources[0]?.name).toBe('my-role');
    expect(constructedResources[1]?.type).toBe('aws:lambda:Function');
    expect(constructedResources[1]?.name).toBe('my-function');
  });

  it('resolves { ref } in properties to resource outputs', async () => {
    const plan = makePlan([
      makePlannedResource({
        name: 'my-role',
        resourceType: 'aws:iam:Role',
        properties: { assumeRolePolicy: '{}' },
      }),
      makePlannedResource({
        name: 'my-policy',
        resourceType: 'aws:iam:Policy',
        properties: { policy: '{}' },
      }),
      makePlannedResource({
        name: 'my-attachment',
        resourceType: 'aws:iam:RolePolicyAttachment',
        properties: {
          role: { ref: 'my-role' },
          policyArn: { ref: 'my-policy' },
        },
        dependsOn: ['my-role', 'my-policy'],
      }),
    ]);

    const fn = createPulumiProgram(plan, DEFAULT_CONFIG);
    await fn();

    expect(constructedResources).toHaveLength(3);
    const attachment = constructedResources[2];
    // role should resolve to the role's .name output
    expect(attachment?.args['role']).toBeDefined();
    // policyArn should resolve to the policy's .arn output
    expect(attachment?.args['policyArn']).toBeDefined();
  });

  it('resolves dotted refs like "queue-name.url"', async () => {
    const plan = makePlan([
      makePlannedResource({
        name: 'work-queue-queue',
        resourceType: 'aws:sqs:Queue',
        properties: { name: 'test-queue' },
      }),
      makePlannedResource({
        name: 'my-param',
        resourceType: 'aws:ssm:Parameter',
        properties: {
          name: '/test/QUEUE_URL',
          type: 'String',
          value: { ref: 'work-queue-queue.url' },
        },
        dependsOn: ['work-queue-queue'],
      }),
    ]);

    const fn = createPulumiProgram(plan, DEFAULT_CONFIG);
    await fn();

    expect(constructedResources).toHaveLength(2);
    const param = constructedResources[1];
    // value should resolve to the queue's .url output
    expect(param?.args['value']).toBeDefined();
  });

  it('handles all supported resource types', async () => {
    const allTypes = [
      'aws:iam:Role',
      'aws:iam:Policy',
      'aws:iam:RolePolicyAttachment',
      'aws:lambda:Function',
      'aws:lambda:EventSourceMapping',
      'aws:lambda:Permission',
      'aws:sqs:Queue',
      'aws:ssm:Parameter',
      'aws:ec2:SecurityGroupRule',
      'aws:dynamodb:Table',
      'aws:s3:Bucket',
      'aws:s3:BucketVersioningV2',
      'aws:apigatewayv2:Api',
      'aws:apigatewayv2:Stage',
      'aws:apigatewayv2:Integration',
      'aws:apigatewayv2:Route',
      'aws:sns:Topic',
    ];

    const resources = allTypes.map((type, i) =>
      makePlannedResource({
        name: `resource-${i}`,
        resourceType: type,
        properties: {},
      }),
    );

    const plan = makePlan(resources);
    const fn = createPulumiProgram(plan, DEFAULT_CONFIG);
    await fn();

    expect(constructedResources).toHaveLength(allTypes.length);
    for (let i = 0; i < allTypes.length; i++) {
      expect(constructedResources[i]?.type).toBe(allTypes[i]);
    }
  });

  it('warns and skips unknown resource types', async () => {
    const plan = makePlan([
      makePlannedResource({
        name: 'unknown-res',
        resourceType: 'aws:unknown:Thing',
        properties: {},
      }),
    ]);

    const fn = createPulumiProgram(plan, DEFAULT_CONFIG);
    await fn();

    expect(constructedResources).toHaveLength(0);
    expect(pulumi.log.warn).toHaveBeenCalledWith(
      expect.stringContaining('aws:unknown:Thing'),
    );
  });

  it('throws when a resource ref points to a missing resource', async () => {
    const plan = makePlan([
      makePlannedResource({
        name: 'my-attachment',
        resourceType: 'aws:iam:RolePolicyAttachment',
        properties: {
          role: { ref: 'missing-role' },
          policyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
        },
      }),
    ]);

    const fn = createPulumiProgram(plan, DEFAULT_CONFIG);
    await expect(fn()).rejects.toThrow('Unresolved ref "missing-role"');
  });

  it('returns stack outputs', async () => {
    const plan = makePlan(
      [
        makePlannedResource({
          name: 'my-function',
          resourceType: 'aws:lambda:Function',
          properties: { functionName: 'test' },
        }),
      ],
      {
        'my-function-arn': '${my-function.arn}',
      },
    );

    const fn = createPulumiProgram(plan, DEFAULT_CONFIG);
    const outputs = await fn();

    expect(outputs['my-function-arn']).toBeDefined();
  });

  it('throws when output template field does not exist', async () => {
    const plan = makePlan(
      [
        makePlannedResource({
          name: 'my-function',
          resourceType: 'aws:lambda:Function',
          properties: { functionName: 'test' },
        }),
      ],
      {
        'my-function-missing': '${my-function.nope}',
      },
    );

    const fn = createPulumiProgram(plan, DEFAULT_CONFIG);
    await expect(fn()).rejects.toThrow(
      'Unresolved output "my-function-missing": field "nope" does not exist on resource "my-function"',
    );
  });

  it('handles empty plan', async () => {
    const plan = makePlan([]);
    const fn = createPulumiProgram(plan, DEFAULT_CONFIG);
    const outputs = await fn();

    expect(constructedResources).toHaveLength(0);
    expect(outputs).toEqual({});
  });

  it('resolves nested { ref } in environment variables', async () => {
    const plan = makePlan([
      makePlannedResource({
        name: 'work-queue-queue',
        resourceType: 'aws:sqs:Queue',
        properties: { name: 'my-queue' },
      }),
      makePlannedResource({
        name: 'my-function',
        resourceType: 'aws:lambda:Function',
        properties: {
          functionName: 'test-fn',
          environment: {
            variables: {
              QUEUE_URL: { ref: 'work-queue-queue.url' },
            },
          },
        },
        dependsOn: ['work-queue-queue'],
      }),
    ]);

    const fn = createPulumiProgram(plan, DEFAULT_CONFIG);
    await fn();

    expect(constructedResources).toHaveLength(2);
    const lambda = constructedResources[1];
    const env = lambda?.args['environment'] as Record<string, unknown> | undefined;
    const vars = env?.['variables'] as Record<string, unknown> | undefined;
    expect(vars?.['QUEUE_URL']).toBeDefined();
  });

  it('preserves non-ref property values as-is', async () => {
    const plan = makePlan([
      makePlannedResource({
        name: 'my-queue',
        resourceType: 'aws:sqs:Queue',
        properties: {
          name: 'literal-name',
          visibilityTimeoutSeconds: 300,
          messageRetentionSeconds: 345600,
          tags: { env: 'test' },
        },
      }),
    ]);

    const fn = createPulumiProgram(plan, DEFAULT_CONFIG);
    await fn();

    const queue = constructedResources[0];
    expect(queue?.args['name']).toBe('literal-name');
    expect(queue?.args['visibilityTimeoutSeconds']).toBe(300);
    expect(queue?.args['messageRetentionSeconds']).toBe(345600);
    expect(queue?.args['tags']).toEqual({ env: 'test' });
  });

  it('string policyArn values are preserved (not treated as refs)', async () => {
    const plan = makePlan([
      makePlannedResource({
        name: 'my-role',
        resourceType: 'aws:iam:Role',
        properties: { assumeRolePolicy: '{}' },
      }),
      makePlannedResource({
        name: 'basic-attachment',
        resourceType: 'aws:iam:RolePolicyAttachment',
        properties: {
          role: { ref: 'my-role' },
          policyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
        },
        dependsOn: ['my-role'],
      }),
    ]);

    const fn = createPulumiProgram(plan, DEFAULT_CONFIG);
    await fn();

    const attachment = constructedResources[1];
    expect(attachment?.args['policyArn']).toBe(
      'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
    );
  });
});
