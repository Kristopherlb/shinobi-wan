import { describe, it, expect } from 'vitest';
import { createTestNode } from '@shinobi/ir';
import { makeDefaultContext, makeDefaultDeps } from './test-helpers';
import { SageMakerPipelineLowerer } from '../lowerers/sagemaker-pipeline-lowerer';

const DEFAULT_CONTEXT = makeDefaultContext();
const DEFAULT_DEPS = makeDefaultDeps();

describe('SageMakerPipelineLowerer', () => {
  const lowerer = new SageMakerPipelineLowerer();

  it('should emit 2 resources (pipeline + log group)', () => {
    const node = createTestNode({
      id: 'platform:training-pipeline',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-sagemaker-pipeline',
          pipelineDefinition: '{"Version": "2020-12-01", "Steps": []}',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result).toHaveLength(2);
    expect(result[0]?.resourceType).toBe('aws:sagemaker:Pipeline');
    expect(result[1]?.resourceType).toBe('aws:cloudwatch:LogGroup');
  });

  it('should follow naming pattern', () => {
    const node = createTestNode({
      id: 'platform:training-pipeline',
      type: 'platform',
      metadata: { properties: { platform: 'aws-sagemaker-pipeline' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.name).toBe('training-pipeline-pipeline');
    expect(result[1]?.name).toBe('training-pipeline-pipeline-log-group');
  });

  it('should include pipeline definition when provided', () => {
    const def = JSON.stringify({ Version: '2020-12-01', Steps: [] });
    const node = createTestNode({
      id: 'platform:pipeline',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-sagemaker-pipeline',
          pipelineDefinition: def,
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.pipelineDefinition).toBe(def);
  });

  it('should include pipeline description', () => {
    const node = createTestNode({
      id: 'platform:pipeline',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-sagemaker-pipeline',
          pipelineDescription: 'Training pipeline for model v2',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.pipelineDescription).toBe(
      'Training pipeline for model v2',
    );
  });

  it('should default to empty description', () => {
    const node = createTestNode({
      id: 'platform:pipeline',
      type: 'platform',
      metadata: { properties: { platform: 'aws-sagemaker-pipeline' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.pipelineDescription).toBe('');
  });

  it('should include parallelism configuration when provided', () => {
    const node = createTestNode({
      id: 'platform:pipeline',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-sagemaker-pipeline',
          parallelismConfiguration: { maxParallelExecutionSteps: 5 },
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.parallelismConfiguration).toEqual({
      maxParallelExecutionSteps: 5,
    });
  });

  it('should omit parallelism configuration when not provided', () => {
    const node = createTestNode({
      id: 'platform:pipeline',
      type: 'platform',
      metadata: { properties: { platform: 'aws-sagemaker-pipeline' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.parallelismConfiguration).toBeUndefined();
  });

  it('should include roleArn when provided', () => {
    const node = createTestNode({
      id: 'platform:pipeline',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-sagemaker-pipeline',
          roleArn: 'arn:aws:iam::123456789012:role/SageMakerRole',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.roleArn).toBe(
      'arn:aws:iam::123456789012:role/SageMakerRole',
    );
  });

  it('should include standard tags', () => {
    const node = createTestNode({
      id: 'platform:pipeline',
      type: 'platform',
      metadata: { properties: { platform: 'aws-sagemaker-pipeline' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = result[0]?.properties?.tags as Record<string, string>;
    expect(tags?.['shinobi:platform']).toBe('aws-sagemaker-pipeline');
  });

  it('should merge custom tags', () => {
    const node = createTestNode({
      id: 'platform:pipeline',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-sagemaker-pipeline',
          tags: { project: 'ml-training' },
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = result[0]?.properties?.tags as Record<string, string>;
    expect(tags?.project).toBe('ml-training');
  });
});
