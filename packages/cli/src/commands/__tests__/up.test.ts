import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'path';

const MANIFEST_PATH = path.resolve(__dirname, '../../../../../examples/lambda-sqs.yaml');

// Mock the deployer functions from adapter-aws so tests don't need Pulumi installed
vi.mock('@shinobi/adapter-aws', async () => {
  const actual = await vi.importActual<typeof import('@shinobi/adapter-aws')>('@shinobi/adapter-aws');
  return {
    ...actual,
    deploy: vi.fn().mockResolvedValue({
      success: true,
      stackName: 'test-stack',
      outputs: { 'function-arn': 'arn:aws:lambda:us-east-1:123:function:test' },
      summary: { resourceChanges: { create: 5 } },
    }),
    preview: vi.fn().mockResolvedValue({
      success: true,
      stackName: 'test-stack',
      changeSummary: { create: 5, update: 0, delete: 0 },
    }),
  };
});

import { up } from '../up';
import { deploy, preview } from '@shinobi/adapter-aws';

describe('up command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('succeeds in dry run mode by default (calls preview)', async () => {
    const result = await up({ manifestPath: MANIFEST_PATH });

    expect(result.success).toBe(true);
    expect(result.deployed).toBe(false);
    expect(result.message).toContain('Preview complete');
    expect(preview).toHaveBeenCalled();
    expect(deploy).not.toHaveBeenCalled();
  });

  it('reports resource count in preview message', async () => {
    const result = await up({ manifestPath: MANIFEST_PATH });

    expect(result.message).toMatch(/\d+ resources would be created/);
  });

  it('plan is populated in dry run', async () => {
    const result = await up({ manifestPath: MANIFEST_PATH });

    expect(result.plan.plan).toBeDefined();
    expect(result.plan.plan?.resources.length).toBeGreaterThan(0);
  });

  it('includes previewResult in dry run', async () => {
    const result = await up({ manifestPath: MANIFEST_PATH });

    expect(result.previewResult).toBeDefined();
    expect(result.previewResult?.success).toBe(true);
    expect(result.previewResult?.changeSummary).toEqual({ create: 5, update: 0, delete: 0 });
  });

  it('calls deploy when dryRun is false', async () => {
    const result = await up({ manifestPath: MANIFEST_PATH, dryRun: false });

    expect(result.success).toBe(true);
    expect(result.deployed).toBe(true);
    expect(result.message).toContain('Deployed');
    expect(deploy).toHaveBeenCalled();
    expect(preview).not.toHaveBeenCalled();
  });

  it('includes deployResult when deployed', async () => {
    const result = await up({ manifestPath: MANIFEST_PATH, dryRun: false });

    expect(result.deployResult).toBeDefined();
    expect(result.deployResult?.success).toBe(true);
    expect(result.deployResult?.outputs['function-arn']).toBe('arn:aws:lambda:us-east-1:123:function:test');
  });

  it('reports stack name after deployment', async () => {
    const result = await up({ manifestPath: MANIFEST_PATH, dryRun: false });

    expect(result.message).toContain('test-stack');
  });

  it('handles deploy failure', async () => {
    (deploy as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      success: false,
      stackName: 'test-stack',
      outputs: {},
      summary: {},
      error: 'AWS credentials not configured',
    });

    const result = await up({ manifestPath: MANIFEST_PATH, dryRun: false });

    expect(result.success).toBe(false);
    expect(result.deployed).toBe(false);
    expect(result.message).toContain('Deployment failed');
    expect(result.message).toContain('AWS credentials not configured');
  });

  it('handles preview failure', async () => {
    (preview as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      success: false,
      stackName: 'test-stack',
      error: 'Pulumi not installed',
    });

    const result = await up({ manifestPath: MANIFEST_PATH });

    expect(result.success).toBe(false);
    expect(result.deployed).toBe(false);
    expect(result.message).toContain('Preview failed');
  });

  it('fails for non-existent manifest', async () => {
    const result = await up({ manifestPath: '/nonexistent/file.yaml' });

    expect(result.success).toBe(false);
    expect(result.deployed).toBe(false);
    expect(result.message).toContain('Plan failed');
    // Should not call deploy or preview when plan fails
    expect(deploy).not.toHaveBeenCalled();
    expect(preview).not.toHaveBeenCalled();
  });

  it('passes policy pack through', async () => {
    const result = await up({ manifestPath: MANIFEST_PATH, policyPack: 'FedRAMP-Moderate' });

    expect(result.plan.validation.policy?.policyPack).toBe('FedRAMP-Moderate');
  });

  it('passes region to adapter config', async () => {
    await up({ manifestPath: MANIFEST_PATH, dryRun: false, region: 'eu-west-1' });

    expect(deploy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ region: 'eu-west-1' }),
      expect.anything(),
    );
  });
});
