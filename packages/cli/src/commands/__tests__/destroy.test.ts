import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'path';

const MANIFEST_PATH = path.resolve(
  __dirname,
  '../../../../../examples/lambda-sqs.yaml',
);

// Mock the deployer functions from adapter-aws so tests don't need Pulumi installed
vi.mock('@shinobi/adapter-aws', async () => {
  const actual = await vi.importActual<typeof import('@shinobi/adapter-aws')>(
    '@shinobi/adapter-aws',
  );
  return {
    ...actual,
    destroy: vi.fn().mockResolvedValue({
      success: true,
      stackName: 'my-lambda-sqs-us-east-1',
      summary: { resourceChanges: { delete: 5 } },
    }),
  };
});

import { destroy } from '../destroy';
import { destroy as destroyStack } from '@shinobi/adapter-aws';

describe('destroy command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is a dry run by default and does not destroy', async () => {
    const result = await destroy({ manifestPath: MANIFEST_PATH });

    expect(result.success).toBe(true);
    expect(result.destroyed).toBe(false);
    expect(result.stackName).toBe('my-lambda-sqs-us-east-1');
    expect(result.message).toContain('Dry run');
    expect(destroyStack).not.toHaveBeenCalled();
  });

  it('destroys the stack with dryRun: false', async () => {
    const result = await destroy({
      manifestPath: MANIFEST_PATH,
      dryRun: false,
    });

    expect(result.success).toBe(true);
    expect(result.destroyed).toBe(true);
    expect(result.message).toContain('Destroyed 5 resources');
    expect(destroyStack).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceName: 'my-lambda-sqs',
        region: 'us-east-1',
      }),
      expect.anything(),
    );
  });

  it('namespaces the stack by environment (EE-3)', async () => {
    const result = await destroy({
      manifestPath: MANIFEST_PATH,
      environment: 'staging',
    });

    expect(result.stackName).toBe('my-lambda-sqs-staging-us-east-1');
  });

  it('forwards backend and secrets provider configuration (EE-4)', async () => {
    await destroy({
      manifestPath: MANIFEST_PATH,
      dryRun: false,
      backendUrl: 's3://state',
      secretsProvider: 'awskms://alias/pulumi',
    });

    expect(destroyStack).toHaveBeenCalledWith(
      expect.objectContaining({
        backendUrl: 's3://state',
        secretsProvider: 'awskms://alias/pulumi',
      }),
      expect.anything(),
    );
  });

  it('fails with a message when the manifest cannot be read', async () => {
    const result = await destroy({ manifestPath: '/nonexistent/file.yaml' });

    expect(result.success).toBe(false);
    expect(result.destroyed).toBe(false);
    expect(destroyStack).not.toHaveBeenCalled();
  });

  it('reports a failed destroy', async () => {
    vi.mocked(destroyStack).mockResolvedValueOnce({
      success: false,
      stackName: 'my-lambda-sqs-us-east-1',
      summary: {},
      error: 'stack locked',
    });

    const result = await destroy({
      manifestPath: MANIFEST_PATH,
      dryRun: false,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('stack locked');
  });
});
