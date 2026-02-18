import { describe, it, expect } from 'vitest';
import { ConfigIntentLowerer } from '../lowerers/config-lowerer';
import { makeConfigIntent, makeContext } from './test-helpers';

const lowerer = new ConfigIntentLowerer();

describe('ConfigIntentLowerer', () => {
  it('produces an SSM Parameter resource', () => {
    const intent = makeConfigIntent();
    const resources = lowerer.lower(intent, makeContext());

    expect(resources).toHaveLength(1);
    expect(resources[0].resourceType).toBe('aws:ssm:Parameter');
  });

  it('name includes service, target, and key', () => {
    const intent = makeConfigIntent();
    const resources = lowerer.lower(intent, makeContext());

    expect(resources[0].name).toBe('my-lambda-sqs-api-handler-QUEUE_URL');
  });

  it('SSM parameter path follows naming convention', () => {
    const intent = makeConfigIntent();
    const resources = lowerer.lower(intent, makeContext());

    expect(resources[0].properties['name']).toBe('/my-lambda-sqs/api-handler/QUEUE_URL');
  });

  it('resolves reference value source to ref', () => {
    const intent = makeConfigIntent({
      valueSource: { type: 'reference', nodeRef: 'work-queue', field: 'url' },
    });
    const resources = lowerer.lower(intent, makeContext());

    expect(resources[0].properties['value']).toEqual({ ref: 'work-queue-queue.url' });
  });

  it('resolves literal value source to string', () => {
    const intent = makeConfigIntent({
      valueSource: { type: 'literal', value: 'some-value' },
    });
    const resources = lowerer.lower(intent, makeContext());

    expect(resources[0].properties['value']).toBe('some-value');
  });

  it('resolves secret value source to secretRef', () => {
    const intent = makeConfigIntent({
      valueSource: { type: 'secret', secretRef: 'my-secret' },
    });
    const resources = lowerer.lower(intent, makeContext());

    expect(resources[0].properties['value']).toEqual({ secretRef: 'my-secret' });
  });

  it('carries tags with shinobi metadata', () => {
    const intent = makeConfigIntent();
    const resources = lowerer.lower(intent, makeContext());

    const tags = resources[0].properties['tags'] as Record<string, string>;
    expect(tags['shinobi:target']).toBe('component:api-handler');
    expect(tags['shinobi:key']).toBe('QUEUE_URL');
    expect(tags['shinobi:edge']).toBe(intent.sourceEdgeId);
  });

  it('determinism: identical input produces identical output', () => {
    const intent = makeConfigIntent();
    const ctx = makeContext();
    const r1 = lowerer.lower(intent, ctx);
    const r2 = lowerer.lower(intent, ctx);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});
