import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ResourcePlan, PlannedResource } from '../program-generator';
import type { AdapterConfig } from '../types';

// Mock the pulumi-program module
vi.mock('../pulumi-program', () => ({
  createPulumiProgram: vi.fn(() => async () => ({ 'test-output': 'test-value' })),
}));

// Mock @pulumi/pulumi/automation — all functions inline (no top-level refs)
vi.mock('@pulumi/pulumi/automation', () => {
  const stack = {
    setConfig: vi.fn().mockResolvedValue(undefined),
    up: vi.fn().mockResolvedValue({
      outputs: {
        'my-function-arn': { value: 'arn:aws:lambda:us-east-1:123456789012:function:my-fn' },
        'my-queue-url': { value: 'https://sqs.us-east-1.amazonaws.com/123456789012/my-queue' },
      },
      summary: {
        resourceChanges: { create: 5 },
      },
    }),
    preview: vi.fn().mockResolvedValue({
      changeSummary: { create: 5, update: 0, delete: 0 },
    }),
  };

  return {
    LocalWorkspace: {
      createOrSelectStack: vi.fn().mockResolvedValue(stack),
    },
    __mockStack: stack,
  };
});

// Import after mocks
import { deploy, preview, classifyError } from '../deployer';
import type { DeployerEvent } from '../deployer';
import * as automation from '@pulumi/pulumi/automation';

// Access the mock stack via the module
function getMockStack() {
  return (automation as unknown as { __mockStack: {
    setConfig: ReturnType<typeof vi.fn>;
    up: ReturnType<typeof vi.fn>;
    preview: ReturnType<typeof vi.fn>;
  } }).__mockStack;
}

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

function makePlan(resources?: PlannedResource[]): ResourcePlan {
  return {
    resources: resources ?? [
      makePlannedResource({ name: 'my-role', resourceType: 'aws:iam:Role', properties: { assumeRolePolicy: '{}' } }),
      makePlannedResource({ name: 'my-function', resourceType: 'aws:lambda:Function', properties: { functionName: 'test' } }),
    ],
    outputs: {
      'my-function-arn': '${my-function.arn}',
    },
  };
}

describe('deploy', () => {
  beforeEach(() => {
    const mockStack = getMockStack();
    vi.clearAllMocks();
    // Re-set defaults after clear
    mockStack.up.mockResolvedValue({
      outputs: {
        'my-function-arn': { value: 'arn:aws:lambda:us-east-1:123456789012:function:my-fn' },
      },
      summary: {
        resourceChanges: { create: 5 },
      },
    });
    mockStack.setConfig.mockResolvedValue(undefined);
    (automation.LocalWorkspace.createOrSelectStack as ReturnType<typeof vi.fn>).mockResolvedValue(mockStack);
  });

  it('creates a stack with correct project and stack name', async () => {
    await deploy(makePlan(), DEFAULT_CONFIG);

    expect(automation.LocalWorkspace.createOrSelectStack).toHaveBeenCalledWith(
      expect.objectContaining({
        stackName: 'test-service-us-east-1',
        projectName: 'test-service',
      }),
    );
  });

  it('sets aws:region config', async () => {
    const mockStack = getMockStack();
    await deploy(makePlan(), DEFAULT_CONFIG);

    expect(mockStack.setConfig).toHaveBeenCalledWith('aws:region', { value: 'us-east-1' });
  });

  it('calls stack.up()', async () => {
    const mockStack = getMockStack();
    await deploy(makePlan(), DEFAULT_CONFIG);

    expect(mockStack.up).toHaveBeenCalled();
  });

  it('returns success result with outputs', async () => {
    const result = await deploy(makePlan(), DEFAULT_CONFIG);

    expect(result.success).toBe(true);
    expect(result.stackName).toBe('test-service-us-east-1');
    expect(result.outputs['my-function-arn']).toBe('arn:aws:lambda:us-east-1:123456789012:function:my-fn');
  });

  it('returns resource changes in summary', async () => {
    const result = await deploy(makePlan(), DEFAULT_CONFIG);

    expect(result.summary.resourceChanges).toEqual({ create: 5 });
  });

  it('uses custom stack name when provided', async () => {
    await deploy(makePlan(), DEFAULT_CONFIG, { stackName: 'custom-stack' });

    expect(automation.LocalWorkspace.createOrSelectStack).toHaveBeenCalledWith(
      expect.objectContaining({ stackName: 'custom-stack' }),
    );
  });

  it('uses custom project name when provided', async () => {
    await deploy(makePlan(), DEFAULT_CONFIG, { projectName: 'custom-project' });

    expect(automation.LocalWorkspace.createOrSelectStack).toHaveBeenCalledWith(
      expect.objectContaining({ projectName: 'custom-project' }),
    );
  });

  it('passes onOutput callback', async () => {
    const mockStack = getMockStack();
    const onOutput = vi.fn();
    await deploy(makePlan(), DEFAULT_CONFIG, { onOutput });

    expect(mockStack.up).toHaveBeenCalledWith(
      expect.objectContaining({ onOutput }),
    );
  });

  it('returns failure result on error', async () => {
    const mockStack = getMockStack();
    mockStack.up.mockRejectedValueOnce(new Error('AWS credentials not configured'));

    const result = await deploy(makePlan(), DEFAULT_CONFIG);

    expect(result.success).toBe(false);
    expect(result.error).toBe('AWS credentials not configured');
    expect(result.outputs).toEqual({});
  });

  it('handles non-Error thrown values', async () => {
    const mockStack = getMockStack();
    mockStack.up.mockRejectedValueOnce('string error');

    const result = await deploy(makePlan(), DEFAULT_CONFIG);

    expect(result.success).toBe(false);
    expect(result.error).toBe('string error');
  });

  it('handles empty plan', async () => {
    const mockStack = getMockStack();
    mockStack.up.mockResolvedValueOnce({
      outputs: {},
      summary: { resourceChanges: {} },
    });

    const result = await deploy(makePlan([]), DEFAULT_CONFIG);

    expect(result.success).toBe(true);
    expect(result.outputs).toEqual({});
  });
});

describe('preview', () => {
  beforeEach(() => {
    const mockStack = getMockStack();
    vi.clearAllMocks();
    mockStack.preview.mockResolvedValue({
      changeSummary: { create: 5, update: 0, delete: 0 },
    });
    mockStack.setConfig.mockResolvedValue(undefined);
    (automation.LocalWorkspace.createOrSelectStack as ReturnType<typeof vi.fn>).mockResolvedValue(mockStack);
  });

  it('creates a stack with correct names', async () => {
    await preview(makePlan(), DEFAULT_CONFIG);

    expect(automation.LocalWorkspace.createOrSelectStack).toHaveBeenCalledWith(
      expect.objectContaining({
        stackName: 'test-service-us-east-1',
        projectName: 'test-service',
      }),
    );
  });

  it('sets aws:region config', async () => {
    const mockStack = getMockStack();
    await preview(makePlan(), DEFAULT_CONFIG);

    expect(mockStack.setConfig).toHaveBeenCalledWith('aws:region', { value: 'us-east-1' });
  });

  it('calls stack.preview()', async () => {
    const mockStack = getMockStack();
    await preview(makePlan(), DEFAULT_CONFIG);

    expect(mockStack.preview).toHaveBeenCalled();
  });

  it('returns success result with change summary', async () => {
    const result = await preview(makePlan(), DEFAULT_CONFIG);

    expect(result.success).toBe(true);
    expect(result.stackName).toBe('test-service-us-east-1');
    expect(result.changeSummary).toEqual({ create: 5, update: 0, delete: 0 });
  });

  it('passes onOutput callback', async () => {
    const mockStack = getMockStack();
    const onOutput = vi.fn();
    await preview(makePlan(), DEFAULT_CONFIG, { onOutput });

    expect(mockStack.preview).toHaveBeenCalledWith(
      expect.objectContaining({ onOutput }),
    );
  });

  it('returns failure result on error', async () => {
    const mockStack = getMockStack();
    mockStack.preview.mockRejectedValueOnce(new Error('Stack not found'));

    const result = await preview(makePlan(), DEFAULT_CONFIG);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Stack not found');
  });

  it('uses custom stack name when provided', async () => {
    await preview(makePlan(), DEFAULT_CONFIG, { stackName: 'preview-stack' });

    expect(automation.LocalWorkspace.createOrSelectStack).toHaveBeenCalledWith(
      expect.objectContaining({ stackName: 'preview-stack' }),
    );
  });
});

describe('classifyError', () => {
  it('classifies AWS credential errors', () => {
    const result = classifyError(new Error('NoCredentialProviders: no valid providers'));

    expect(result.category).toBe('aws-credentials');
    expect(result.retryable).toBe(false);
    expect(result.originalError).toBeInstanceOf(Error);
  });

  it('classifies ExpiredToken as aws-credentials', () => {
    const result = classifyError(new Error('ExpiredToken: the security token included in the request is expired'));

    expect(result.category).toBe('aws-credentials');
    expect(result.retryable).toBe(false);
  });

  it('classifies stack conflict errors as retryable', () => {
    const result = classifyError(new Error('Stack is already being updated'));

    expect(result.category).toBe('stack-conflict');
    expect(result.retryable).toBe(true);
  });

  it('classifies timeout errors as retryable', () => {
    const result = classifyError(new Error('Operation timed out'));

    expect(result.category).toBe('timeout');
    expect(result.retryable).toBe(true);
  });

  it('classifies pulumi runtime errors', () => {
    const result = classifyError(new Error('failed to load plugin'));

    expect(result.category).toBe('pulumi-runtime');
    expect(result.retryable).toBe(false);
  });

  it('classifies unknown errors as not retryable', () => {
    const result = classifyError(new Error('Something unexpected happened'));

    expect(result.category).toBe('unknown');
    expect(result.retryable).toBe(false);
  });

  it('handles non-Error values', () => {
    const result = classifyError('string error');

    expect(result.category).toBe('unknown');
    expect(result.message).toBe('string error');
    expect(result.originalError).toBeUndefined();
  });
});

describe('error detail in results', () => {
  beforeEach(() => {
    const mockStack = getMockStack();
    vi.clearAllMocks();
    mockStack.up.mockResolvedValue({
      outputs: { 'my-function-arn': { value: 'arn:test' } },
      summary: { resourceChanges: { create: 5 } },
    });
    mockStack.preview.mockResolvedValue({
      changeSummary: { create: 5 },
    });
    mockStack.setConfig.mockResolvedValue(undefined);
    (automation.LocalWorkspace.createOrSelectStack as ReturnType<typeof vi.fn>).mockResolvedValue(mockStack);
  });

  it('deploy includes errorDetail for AWS credential errors', async () => {
    const mockStack = getMockStack();
    mockStack.up.mockRejectedValueOnce(new Error('NoCredentialProviders: no valid providers'));

    const result = await deploy(makePlan(), DEFAULT_CONFIG);

    expect(result.success).toBe(false);
    expect(result.errorDetail?.category).toBe('aws-credentials');
    expect(result.errorDetail?.retryable).toBe(false);
  });

  it('preview includes errorDetail for stack conflict errors', async () => {
    const mockStack = getMockStack();
    mockStack.preview.mockRejectedValueOnce(new Error('Stack is already being updated'));

    const result = await preview(makePlan(), DEFAULT_CONFIG);

    expect(result.success).toBe(false);
    expect(result.errorDetail?.category).toBe('stack-conflict');
    expect(result.errorDetail?.retryable).toBe(true);
  });

  it('deploy with timeout fires timeout error', async () => {
    const mockStack = getMockStack();
    mockStack.up.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(resolve, 5000))
    );

    const result = await deploy(makePlan(), DEFAULT_CONFIG, { timeoutMs: 50 });

    expect(result.success).toBe(false);
    expect(result.errorDetail?.category).toBe('timeout');
    expect(result.errorDetail?.retryable).toBe(true);
  });

  it('success result has no errorDetail', async () => {
    const result = await deploy(makePlan(), DEFAULT_CONFIG);

    expect(result.success).toBe(true);
    expect(result.errorDetail).toBeUndefined();
  });
});

describe('onEvent callbacks', () => {
  beforeEach(() => {
    const mockStack = getMockStack();
    vi.clearAllMocks();
    mockStack.up.mockResolvedValue({
      outputs: { 'my-function-arn': { value: 'arn:test' } },
      summary: { resourceChanges: { create: 5 } },
    });
    mockStack.preview.mockResolvedValue({
      changeSummary: { create: 5 },
    });
    mockStack.setConfig.mockResolvedValue(undefined);
    (automation.LocalWorkspace.createOrSelectStack as ReturnType<typeof vi.fn>).mockResolvedValue(mockStack);
  });

  it('deploy emits progress events on success', async () => {
    const events: DeployerEvent[] = [];
    await deploy(makePlan(), DEFAULT_CONFIG, {
      onEvent: (e) => events.push(e),
    });

    expect(events.map((e) => e.type)).toEqual([
      'stack-creating',
      'stack-configuring',
      'deploying',
      'complete',
    ]);
  });

  it('preview emits progress events on success', async () => {
    const events: DeployerEvent[] = [];
    await preview(makePlan(), DEFAULT_CONFIG, {
      onEvent: (e) => events.push(e),
    });

    expect(events.map((e) => e.type)).toEqual([
      'stack-creating',
      'stack-configuring',
      'previewing',
      'complete',
    ]);
  });

  it('deploy emits error event on failure', async () => {
    const mockStack = getMockStack();
    mockStack.up.mockRejectedValueOnce(new Error('ExpiredToken: token expired'));

    const events: DeployerEvent[] = [];
    await deploy(makePlan(), DEFAULT_CONFIG, {
      onEvent: (e) => events.push(e),
    });

    const errorEvent = events.find((e) => e.type === 'error');
    expect(errorEvent).toBeDefined();
    expect(errorEvent?.type === 'error' && errorEvent.error.category).toBe('aws-credentials');
  });

  it('all events include stackName', async () => {
    const events: DeployerEvent[] = [];
    await deploy(makePlan(), DEFAULT_CONFIG, {
      onEvent: (e) => events.push(e),
    });

    for (const event of events) {
      expect(event.stackName).toBe('test-service-us-east-1');
    }
  });
});
