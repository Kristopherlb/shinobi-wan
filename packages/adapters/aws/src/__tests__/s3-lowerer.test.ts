import { describe, it, expect } from 'vitest';
import { S3Lowerer } from '../lowerers/s3-lowerer';
import { makeNode, makeContext } from './test-helpers';
import type { ResolvedDeps } from '../types';

describe('S3Lowerer', () => {
  const lowerer = new S3Lowerer();

  const s3Node = makeNode({
    id: 'platform:assets',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-s3',
      },
    },
  });

  const deps: ResolvedDeps = { envVars: {}, securityGroups: [] };

  it('has platform "aws-s3"', () => {
    expect(lowerer.platform).toBe('aws-s3');
  });

  it('produces an S3 Bucket resource', () => {
    const resources = lowerer.lower(s3Node, makeContext(), deps);

    expect(resources).toHaveLength(1);
    expect(resources[0].resourceType).toBe('aws:s3:Bucket');
  });

  it('bucket name includes service name prefix', () => {
    const resources = lowerer.lower(s3Node, makeContext(), deps);

    expect(resources[0].properties['bucket']).toBe('my-lambda-sqs-assets');
  });

  it('carries shinobi tags', () => {
    const resources = lowerer.lower(s3Node, makeContext(), deps);

    const tags = resources[0].properties['tags'] as Record<string, string>;
    expect(tags['shinobi:node']).toBe('platform:assets');
    expect(tags['shinobi:platform']).toBe('aws-s3');
  });

  it('does not produce versioning when not enabled', () => {
    const resources = lowerer.lower(s3Node, makeContext(), deps);

    expect(resources).toHaveLength(1);
    expect(resources.every((r) => r.resourceType !== 'aws:s3:BucketVersioningV2')).toBe(true);
  });

  it('produces versioning resource when versioning is true', () => {
    const node = makeNode({
      id: 'platform:versioned-bucket',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-s3',
          versioning: true,
        },
      },
    });
    const resources = lowerer.lower(node, makeContext(), deps);

    expect(resources).toHaveLength(2);
    const versioning = resources.find((r) => r.resourceType === 'aws:s3:BucketVersioningV2');
    expect(versioning).toBeDefined();
    expect(versioning?.properties['versioningConfiguration']).toEqual({ status: 'Enabled' });
  });

  it('versioning resource depends on bucket', () => {
    const node = makeNode({
      id: 'platform:versioned-bucket',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-s3',
          versioning: true,
        },
      },
    });
    const resources = lowerer.lower(node, makeContext(), deps);

    const versioning = resources.find((r) => r.resourceType === 'aws:s3:BucketVersioningV2');
    expect(versioning?.dependsOn).toContain('versioned-bucket-bucket');
  });

  it('versioning resource references bucket via ref', () => {
    const node = makeNode({
      id: 'platform:versioned-bucket',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-s3',
          versioning: true,
        },
      },
    });
    const resources = lowerer.lower(node, makeContext(), deps);

    const versioning = resources.find((r) => r.resourceType === 'aws:s3:BucketVersioningV2');
    expect(versioning?.properties['bucket']).toEqual({ ref: 'versioned-bucket-bucket' });
  });

  it('resource name uses short name from node ID', () => {
    const resources = lowerer.lower(s3Node, makeContext(), deps);

    expect(resources[0].name).toBe('assets-bucket');
  });
});
