import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { plan, planAsync } from '../plan';

const MANIFEST_PATH = path.resolve(__dirname, '../../../../../examples/lambda-sqs.yaml');

describe('plan command', () => {
  it('succeeds with the example Lambda+SQS manifest', () => {
    const result = plan({ manifestPath: MANIFEST_PATH });

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('produces adapter result with resources', () => {
    const result = plan({ manifestPath: MANIFEST_PATH });

    expect(result.adapter).toBeDefined();
    expect(result.adapter?.resources.length).toBeGreaterThan(0);
    expect(result.adapter?.success).toBe(true);
  });

  it('produces a resource plan', () => {
    const result = plan({ manifestPath: MANIFEST_PATH });

    expect(result.plan).toBeDefined();
    expect(result.plan?.resources.length).toBeGreaterThan(0);
  });

  it('plan contains all expected resource types', () => {
    const result = plan({ manifestPath: MANIFEST_PATH });

    const types = new Set(result.plan?.resources.map((r) => r.resourceType));
    expect(types.has('aws:iam:Role')).toBe(true);
    expect(types.has('aws:iam:Policy')).toBe(true);
    expect(types.has('aws:iam:RolePolicyAttachment')).toBe(true);
    expect(types.has('aws:lambda:Function')).toBe(true);
    expect(types.has('aws:sqs:Queue')).toBe(true);
    expect(types.has('aws:lambda:EventSourceMapping')).toBe(true);
    expect(types.has('aws:ssm:Parameter')).toBe(true);
  });

  it('plan has outputs for Lambda and SQS', () => {
    const result = plan({ manifestPath: MANIFEST_PATH });

    const outputKeys = Object.keys(result.plan?.outputs ?? {});
    expect(outputKeys.some((k) => k.includes('function'))).toBe(true);
    expect(outputKeys.some((k) => k.includes('queue'))).toBe(true);
  });

  it('resources are in topological order', () => {
    const result = plan({ manifestPath: MANIFEST_PATH });

    const nameIndex = new Map(result.plan?.resources.map((r, i) => [r.name, i]));

    for (const resource of result.plan?.resources ?? []) {
      for (const dep of resource.dependsOn) {
        const depIndex = nameIndex.get(dep);
        const resIndex = nameIndex.get(resource.name);
        if (depIndex !== undefined && resIndex !== undefined) {
          expect(depIndex).toBeLessThan(resIndex);
        }
      }
    }
  });

  it('uses custom region when specified', () => {
    const result = plan({ manifestPath: MANIFEST_PATH, region: 'eu-west-1' });
    expect(result.success).toBe(true);
  });

  it('fails for non-existent manifest', () => {
    const result = plan({ manifestPath: '/nonexistent/file.yaml' });

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('passes policy pack through to validation', () => {
    const result = plan({ manifestPath: MANIFEST_PATH, policyPack: 'FedRAMP-High' });

    expect(result.validation.policy?.policyPack).toBe('FedRAMP-High');
  });

  it('determinism: same manifest produces identical plan', () => {
    const r1 = plan({ manifestPath: MANIFEST_PATH });
    const r2 = plan({ manifestPath: MANIFEST_PATH });

    expect(JSON.stringify(r1.plan)).toBe(JSON.stringify(r2.plan));
  });

  it('supports async plan with progress callbacks', async () => {
    const phases: string[] = [];
    const result = await planAsync({
      manifestPath: MANIFEST_PATH,
      onProgress: (phase) => phases.push(phase),
    });
    expect(result.success).toBe(true);
    expect(phases).toEqual(['validate', 'lower', 'generate-plan', 'complete']);
  });
});
