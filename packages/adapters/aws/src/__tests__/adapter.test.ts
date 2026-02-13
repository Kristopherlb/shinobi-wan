import { describe, it, expect } from 'vitest';
import { lower } from '../adapter';
import { generatePlan } from '../program-generator';
import { makeContext, makeIamIntent, makeNetworkIntent, makeConfigIntent, DEFAULT_ADAPTER_CONFIG } from './test-helpers';

describe('lower (adapter orchestrator)', () => {
  it('produces resources from all intent types', () => {
    const result = lower(makeContext());

    expect(result.success).toBe(true);
    expect(result.resources.length).toBeGreaterThan(0);

    const types = new Set(result.resources.map((r) => r.resourceType));
    expect(types.has('aws:iam:Role')).toBe(true);
    expect(types.has('aws:iam:Policy')).toBe(true);
    expect(types.has('aws:iam:RolePolicyAttachment')).toBe(true);
    expect(types.has('aws:ec2:SecurityGroupRule')).toBe(true);
    expect(types.has('aws:ssm:Parameter')).toBe(true);
  });

  it('produces node resources for Lambda and SQS', () => {
    const result = lower(makeContext());

    const types = new Set(result.resources.map((r) => r.resourceType));
    expect(types.has('aws:lambda:Function')).toBe(true);
    expect(types.has('aws:sqs:Queue')).toBe(true);
  });

  it('produces EventSourceMapping for Lambda→SQS binding', () => {
    const result = lower(makeContext());

    const esm = result.resources.find((r) => r.resourceType === 'aws:lambda:EventSourceMapping');
    expect(esm).toBeDefined();
    expect(esm?.name).toBe('api-handler-work-queue-event-mapping');
    expect(esm?.dependsOn).toContain('api-handler-function');
    expect(esm?.dependsOn).toContain('work-queue-queue');
  });

  it('resources are sorted deterministically by name', () => {
    const result = lower(makeContext());

    const names = result.resources.map((r) => r.name);
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });

  it('deduplicates resources by name', () => {
    const result = lower(makeContext());

    const names = result.resources.map((r) => r.name);
    const unique = new Set(names);
    expect(names.length).toBe(unique.size);
  });

  it('populates resourceMap tracking intent→resource names', () => {
    const result = lower(makeContext());

    // The edge that generated the intents should have resource entries
    const edgeResources = result.resourceMap['edge:bindsTo:component:api-handler:platform:work-queue'];
    expect(edgeResources).toBeDefined();
    expect(edgeResources.length).toBeGreaterThan(0);
  });

  it('Lambda function references the IAM role', () => {
    const result = lower(makeContext());

    const lambda = result.resources.find((r) => r.resourceType === 'aws:lambda:Function');
    expect(lambda?.properties['role']).toEqual({ ref: 'api-handler-exec-role' });
  });

  it('Lambda function includes QUEUE_URL env var', () => {
    const result = lower(makeContext());

    const lambda = result.resources.find((r) => r.resourceType === 'aws:lambda:Function');
    const env = lambda?.properties['environment'] as Record<string, unknown> | undefined;
    expect(env?.['variables']).toBeDefined();
    const vars = env?.['variables'] as Record<string, unknown>;
    expect(vars['QUEUE_URL']).toBeDefined();
  });

  it('silently skips telemetry intents', () => {
    const ctx = makeContext({
      intents: [
        makeIamIntent(),
        {
          type: 'telemetry' as const,
          schemaVersion: '1.0.0' as const,
          sourceEdgeId: 'edge:bindsTo:component:api-handler:platform:work-queue',
          targetNodeRef: 'component:api-handler',
          telemetryType: 'logs' as const,
          config: { enabled: true },
        },
      ],
    });

    const result = lower(ctx);
    expect(result.success).toBe(true);
    // No warning for telemetry
    expect(result.diagnostics.some((d) => d.message.includes('telemetry'))).toBe(false);
  });

  it('determinism: identical input produces identical output', () => {
    const ctx = makeContext();
    const r1 = lower(ctx);
    const r2 = lower(ctx);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it('no upward leakage: resources never contain AWS ARN values', () => {
    const result = lower(makeContext());

    for (const r of result.resources) {
      const json = JSON.stringify(r.properties);
      // The only ARN allowed is the managed policy reference
      const withoutManagedPolicy = json.replace(
        'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
        ''
      );
      // No other arn: patterns should exist
      expect(withoutManagedPolicy).not.toMatch(/arn:aws:[a-z]+:[a-z0-9-]*:\d{12}:/);
    }
  });
});

describe('generatePlan', () => {
  it('produces a plan from adapter result', () => {
    const result = lower(makeContext());
    const plan = generatePlan(result, DEFAULT_ADAPTER_CONFIG);

    expect(plan.resources.length).toBeGreaterThan(0);
  });

  it('resources are topologically sorted (deps before dependents)', () => {
    const result = lower(makeContext());
    const plan = generatePlan(result, DEFAULT_ADAPTER_CONFIG);

    const nameIndex = new Map(plan.resources.map((r, i) => [r.name, i]));

    for (const resource of plan.resources) {
      for (const dep of resource.dependsOn) {
        const depIndex = nameIndex.get(dep);
        const resIndex = nameIndex.get(resource.name);
        if (depIndex !== undefined && resIndex !== undefined) {
          expect(depIndex).toBeLessThan(resIndex);
        }
      }
    }
  });

  it('plan includes Lambda and SQS outputs', () => {
    const result = lower(makeContext());
    const plan = generatePlan(result, DEFAULT_ADAPTER_CONFIG);

    const outputKeys = Object.keys(plan.outputs);
    expect(outputKeys.some((k) => k.includes('function'))).toBe(true);
    expect(outputKeys.some((k) => k.includes('queue'))).toBe(true);
  });

  it('determinism: identical input produces identical plan', () => {
    const result = lower(makeContext());
    const p1 = generatePlan(result, DEFAULT_ADAPTER_CONFIG);
    const p2 = generatePlan(result, DEFAULT_ADAPTER_CONFIG);
    expect(JSON.stringify(p1)).toBe(JSON.stringify(p2));
  });
});
