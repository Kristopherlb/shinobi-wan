import { describe, it, expect } from 'vitest';
import { SageMakerEndpointLowerer } from '../lowerers/sagemaker-endpoint-lowerer';
import { makeNode, makeDefaultContext, makeDefaultDeps } from './test-helpers';

const DEFAULT_CONTEXT = makeDefaultContext({ adapterConfig: { region: 'us-east-1', serviceName: 'my-service' } });
const DEFAULT_DEPS = makeDefaultDeps();

describe('SageMakerEndpointLowerer', () => {
  const lowerer = new SageMakerEndpointLowerer();

  it('has correct platform', () => {
    expect(lowerer.platform).toBe('aws-sagemaker-endpoint');
  });

  it('produces Model + EndpointConfig + Endpoint resources', () => {
    const node = makeNode({
      id: 'platform:model-endpoint',
      type: 'platform',
      metadata: { properties: { platform: 'aws-sagemaker-endpoint' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources).toHaveLength(3);
    expect(resources[0].resourceType).toBe('aws:sagemaker:Model');
    expect(resources[1].resourceType).toBe('aws:sagemaker:EndpointConfiguration');
    expect(resources[2].resourceType).toBe('aws:sagemaker:Endpoint');
  });

  it('uses correct naming convention', () => {
    const node = makeNode({
      id: 'platform:model-endpoint',
      type: 'platform',
      metadata: { properties: { platform: 'aws-sagemaker-endpoint' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].name).toBe('model-endpoint-sm-model');
    expect(resources[1].name).toBe('model-endpoint-sm-endpoint-config');
    expect(resources[2].name).toBe('model-endpoint-sm-endpoint');
  });

  it('sets correct tags', () => {
    const node = makeNode({
      id: 'platform:model-endpoint',
      type: 'platform',
      metadata: { properties: { platform: 'aws-sagemaker-endpoint' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = resources[0].properties['tags'] as Record<string, string>;
    expect(tags['shinobi:node']).toBe('platform:model-endpoint');
    expect(tags['shinobi:platform']).toBe('aws-sagemaker-endpoint');
  });

  it('applies default config values', () => {
    const node = makeNode({
      id: 'platform:model-endpoint',
      type: 'platform',
      metadata: { properties: { platform: 'aws-sagemaker-endpoint' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const variants = resources[1].properties['productionVariants'] as Record<string, unknown>[];
    expect(variants[0]['instanceType']).toBe('ml.m5.large');
    expect(variants[0]['initialInstanceCount']).toBe(1);
    expect(variants[0]['variantName']).toBe('AllTraffic');
  });

  it('endpoint config depends on model', () => {
    const node = makeNode({
      id: 'platform:model-endpoint',
      type: 'platform',
      metadata: { properties: { platform: 'aws-sagemaker-endpoint' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[1].dependsOn).toContain('model-endpoint-sm-model');
  });

  it('endpoint depends on endpoint config', () => {
    const node = makeNode({
      id: 'platform:model-endpoint',
      type: 'platform',
      metadata: { properties: { platform: 'aws-sagemaker-endpoint' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[2].dependsOn).toContain('model-endpoint-sm-endpoint-config');
    expect(resources[2].properties['endpointConfigName']).toEqual({ ref: 'model-endpoint-sm-endpoint-config' });
  });

  it('passes model image and data URL', () => {
    const node = makeNode({
      id: 'platform:model-endpoint',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-sagemaker-endpoint',
          modelImage: '123456789.dkr.ecr.us-east-1.amazonaws.com/my-model:latest',
          modelDataUrl: 's3://my-bucket/model.tar.gz',
        },
      },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const container = resources[0].properties['primaryContainer'] as Record<string, unknown>;
    expect(container['image']).toBe('123456789.dkr.ecr.us-east-1.amazonaws.com/my-model:latest');
    expect(container['modelDataUrl']).toBe('s3://my-bucket/model.tar.gz');
  });

  it('includes VPC config when provided', () => {
    const node = makeNode({
      id: 'platform:model-endpoint',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-sagemaker-endpoint',
          vpcConfig: { subnetIds: ['subnet-1'], securityGroupIds: ['sg-1'] },
        },
      },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const vpc = resources[0].properties['vpcConfig'] as Record<string, unknown>;
    expect(vpc['subnetIds']).toEqual(['subnet-1']);
  });

  it('sets sourceId to node ID', () => {
    const node = makeNode({
      id: 'platform:model-endpoint',
      type: 'platform',
      metadata: { properties: { platform: 'aws-sagemaker-endpoint' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    for (const r of resources) {
      expect(r.sourceId).toBe('platform:model-endpoint');
    }
  });

  it('output is deterministic', () => {
    const node = makeNode({
      id: 'platform:model-endpoint',
      type: 'platform',
      metadata: { properties: { platform: 'aws-sagemaker-endpoint' } },
    });

    const r1 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const r2 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it('passes custom tags', () => {
    const node = makeNode({
      id: 'platform:model-endpoint',
      type: 'platform',
      metadata: { properties: { platform: 'aws-sagemaker-endpoint', tags: { env: 'prod' } } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = resources[0].properties['tags'] as Record<string, string>;
    expect(tags['env']).toBe('prod');
  });
});
