import { describe, it, expect } from 'vitest';
import { KinesisFirehoseLowerer } from '../lowerers/kinesis-firehose-lowerer';
import { LogSubscriptionFilterLowerer } from '../lowerers/log-subscription-filter-lowerer';
import { makeNode, makeDefaultContext, makeDefaultDeps } from './test-helpers';

const DEFAULT_CONTEXT = makeDefaultContext({ adapterConfig: { region: 'us-east-1', serviceName: 'my-service' } });
const DEFAULT_DEPS = makeDefaultDeps();

describe('KinesisFirehoseLowerer', () => {
  const lowerer = new KinesisFirehoseLowerer();

  it('has correct platform', () => {
    expect(lowerer.platform).toBe('aws-kinesis-firehose');
  });

  it('produces FirehoseDeliveryStream resource', () => {
    const node = makeNode({
      id: 'platform:firehose',
      type: 'platform',
      metadata: { properties: { platform: 'aws-kinesis-firehose' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources).toHaveLength(1);
    expect(resources[0].resourceType).toBe('aws:kinesis:FirehoseDeliveryStream');
  });

  it('uses correct naming convention', () => {
    const node = makeNode({
      id: 'platform:firehose',
      type: 'platform',
      metadata: { properties: { platform: 'aws-kinesis-firehose' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].name).toBe('firehose-firehose');
    expect(resources[0].properties['name']).toBe('my-service-firehose');
  });

  it('sets correct tags', () => {
    const node = makeNode({
      id: 'platform:firehose',
      type: 'platform',
      metadata: { properties: { platform: 'aws-kinesis-firehose' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = resources[0].properties['tags'] as Record<string, string>;
    expect(tags['shinobi:node']).toBe('platform:firehose');
    expect(tags['shinobi:platform']).toBe('aws-kinesis-firehose');
  });

  it('defaults to opensearch destination', () => {
    const node = makeNode({
      id: 'platform:firehose',
      type: 'platform',
      metadata: { properties: { platform: 'aws-kinesis-firehose' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].properties['destination']).toBe('opensearch');
  });

  it('uses s3 destination when configured', () => {
    const node = makeNode({
      id: 'platform:firehose',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-kinesis-firehose',
          destinationType: 's3',
          s3BucketArn: { ref: 'backup-bucket.arn' },
        },
      },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].properties['destination']).toBe('extended_s3');
    const s3Config = resources[0].properties['extendedS3Configuration'] as Record<string, unknown>;
    expect(s3Config).toBeDefined();
  });

  it('applies encryption when enabled', () => {
    const node = makeNode({
      id: 'platform:firehose',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-kinesis-firehose',
          encryptionEnabled: true,
        },
      },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const sse = resources[0].properties['serverSideEncryption'] as Record<string, unknown>;
    expect(sse['enabled']).toBe(true);
  });

  it('uses custom buffering config', () => {
    const node = makeNode({
      id: 'platform:firehose',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-kinesis-firehose',
          bufferingIntervalSeconds: 120,
          bufferingSizeMBs: 10,
        },
      },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const osConfig = resources[0].properties['opensearchConfiguration'] as Record<string, unknown>;
    const hints = osConfig['bufferingHints'] as Record<string, unknown>;
    expect(hints['intervalInSeconds']).toBe(120);
    expect(hints['sizeInMBs']).toBe(10);
  });

  it('sets sourceId to node ID', () => {
    const node = makeNode({
      id: 'platform:firehose',
      type: 'platform',
      metadata: { properties: { platform: 'aws-kinesis-firehose' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].sourceId).toBe('platform:firehose');
  });

  it('output is deterministic', () => {
    const node = makeNode({
      id: 'platform:firehose',
      type: 'platform',
      metadata: { properties: { platform: 'aws-kinesis-firehose' } },
    });

    const r1 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const r2 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it('passes custom tags', () => {
    const node = makeNode({
      id: 'platform:firehose',
      type: 'platform',
      metadata: { properties: { platform: 'aws-kinesis-firehose', tags: { env: 'prod' } } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = resources[0].properties['tags'] as Record<string, string>;
    expect(tags['env']).toBe('prod');
  });
});

describe('LogSubscriptionFilterLowerer', () => {
  const lowerer = new LogSubscriptionFilterLowerer();

  it('has correct platform', () => {
    expect(lowerer.platform).toBe('aws-log-subscription-filter');
  });

  it('produces LogSubscriptionFilter resource', () => {
    const node = makeNode({
      id: 'platform:app-logs',
      type: 'platform',
      metadata: { properties: { platform: 'aws-log-subscription-filter' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources).toHaveLength(1);
    expect(resources[0].resourceType).toBe('aws:cloudwatch:LogSubscriptionFilter');
  });

  it('uses correct naming convention', () => {
    const node = makeNode({
      id: 'platform:app-logs',
      type: 'platform',
      metadata: { properties: { platform: 'aws-log-subscription-filter' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].name).toBe('app-logs-log-sub-filter');
    expect(resources[0].properties['name']).toBe('my-service-app-logs');
  });

  it('defaults to empty filterPattern and ByLogStream distribution', () => {
    const node = makeNode({
      id: 'platform:app-logs',
      type: 'platform',
      metadata: { properties: { platform: 'aws-log-subscription-filter' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].properties['filterPattern']).toBe('');
    expect(resources[0].properties['distribution']).toBe('ByLogStream');
  });

  it('uses custom filterPattern', () => {
    const node = makeNode({
      id: 'platform:app-logs',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-log-subscription-filter',
          filterPattern: '[ERROR]',
        },
      },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].properties['filterPattern']).toBe('[ERROR]');
  });

  it('sets sourceId to node ID', () => {
    const node = makeNode({
      id: 'platform:app-logs',
      type: 'platform',
      metadata: { properties: { platform: 'aws-log-subscription-filter' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].sourceId).toBe('platform:app-logs');
  });

  it('output is deterministic', () => {
    const node = makeNode({
      id: 'platform:app-logs',
      type: 'platform',
      metadata: { properties: { platform: 'aws-log-subscription-filter' } },
    });

    const r1 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const r2 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it('passes custom tags', () => {
    const node = makeNode({
      id: 'platform:app-logs',
      type: 'platform',
      metadata: { properties: { platform: 'aws-log-subscription-filter', tags: { env: 'prod' } } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = resources[0].properties['tags'] as Record<string, string>;
    expect(tags['env']).toBe('prod');
  });
});
