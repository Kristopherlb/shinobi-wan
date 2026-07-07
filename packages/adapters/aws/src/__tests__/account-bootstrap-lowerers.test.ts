import { describe, it, expect } from 'vitest';
import { ConfigRecorderLowerer } from '../lowerers/config-recorder-lowerer';
import { SecurityHubLowerer } from '../lowerers/securityhub-lowerer';
import { GuardDutyLowerer } from '../lowerers/guardduty-lowerer';
import { CloudTrailLowerer } from '../lowerers/cloudtrail-lowerer';
import { makeNode, makeDefaultContext, makeDefaultDeps } from './test-helpers';

const DEFAULT_CONTEXT = makeDefaultContext({
  adapterConfig: { region: 'us-east-1', serviceName: 'my-account' },
});
const DEFAULT_DEPS = makeDefaultDeps();

describe('ConfigRecorderLowerer', () => {
  const lowerer = new ConfigRecorderLowerer();

  it('has correct platform', () => {
    expect(lowerer.platform).toBe('aws-config-recorder');
  });

  it('produces Recorder + DeliveryChannel + RecorderStatus resources', () => {
    const node = makeNode({
      id: 'platform:config-recorder',
      type: 'platform',
      metadata: { properties: { platform: 'aws-config-recorder' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources).toHaveLength(3);
    expect(resources[0].resourceType).toBe('aws:cfg:Recorder');
    expect(resources[1].resourceType).toBe('aws:cfg:DeliveryChannel');
    expect(resources[2].resourceType).toBe('aws:cfg:RecorderStatus');
  });

  it('uses correct naming convention', () => {
    const node = makeNode({
      id: 'platform:config-recorder',
      type: 'platform',
      metadata: { properties: { platform: 'aws-config-recorder' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].name).toBe('config-recorder-config-recorder');
    expect(resources[1].name).toBe('config-recorder-config-delivery-channel');
    expect(resources[2].name).toBe('config-recorder-config-recorder-status');
  });

  it('channel depends on recorder, status depends on both', () => {
    const node = makeNode({
      id: 'platform:config-recorder',
      type: 'platform',
      metadata: { properties: { platform: 'aws-config-recorder' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[1].dependsOn).toContain('config-recorder-config-recorder');
    expect(resources[2].dependsOn).toContain('config-recorder-config-recorder');
    expect(resources[2].dependsOn).toContain(
      'config-recorder-config-delivery-channel',
    );
  });

  it('defaults to allSupported recording', () => {
    const node = makeNode({
      id: 'platform:config-recorder',
      type: 'platform',
      metadata: { properties: { platform: 'aws-config-recorder' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const group = resources[0].properties['recordingGroup'] as Record<
      string,
      unknown
    >;
    expect(group['allSupported']).toBe(true);
    expect(group['includeGlobalResourceTypes']).toBe(true);
  });

  it('sets sourceId to node ID', () => {
    const node = makeNode({
      id: 'platform:config-recorder',
      type: 'platform',
      metadata: { properties: { platform: 'aws-config-recorder' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    for (const r of resources) {
      expect(r.sourceId).toBe('platform:config-recorder');
    }
  });

  it('output is deterministic', () => {
    const node = makeNode({
      id: 'platform:config-recorder',
      type: 'platform',
      metadata: { properties: { platform: 'aws-config-recorder' } },
    });

    const r1 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const r2 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});

describe('SecurityHubLowerer', () => {
  const lowerer = new SecurityHubLowerer();

  it('has correct platform', () => {
    expect(lowerer.platform).toBe('aws-securityhub');
  });

  it('produces Account + StandardsSubscription by default', () => {
    const node = makeNode({
      id: 'platform:security-hub',
      type: 'platform',
      metadata: { properties: { platform: 'aws-securityhub' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources).toHaveLength(2);
    expect(resources[0].resourceType).toBe('aws:securityhub:Account');
    expect(resources[1].resourceType).toBe(
      'aws:securityhub:StandardsSubscription',
    );
  });

  it('standard depends on account', () => {
    const node = makeNode({
      id: 'platform:security-hub',
      type: 'platform',
      metadata: { properties: { platform: 'aws-securityhub' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[1].dependsOn).toContain('security-hub-securityhub');
  });

  it('skips standards when disabled', () => {
    const node = makeNode({
      id: 'platform:security-hub',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-securityhub',
          enableDefaultStandards: false,
        },
      },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources).toHaveLength(1);
  });

  it('sets sourceId to node ID', () => {
    const node = makeNode({
      id: 'platform:security-hub',
      type: 'platform',
      metadata: { properties: { platform: 'aws-securityhub' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    for (const r of resources) {
      expect(r.sourceId).toBe('platform:security-hub');
    }
  });

  it('output is deterministic', () => {
    const node = makeNode({
      id: 'platform:security-hub',
      type: 'platform',
      metadata: { properties: { platform: 'aws-securityhub' } },
    });

    const r1 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const r2 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});

describe('GuardDutyLowerer', () => {
  const lowerer = new GuardDutyLowerer();

  it('has correct platform', () => {
    expect(lowerer.platform).toBe('aws-guardduty');
  });

  it('produces Detector resource', () => {
    const node = makeNode({
      id: 'platform:guardduty',
      type: 'platform',
      metadata: { properties: { platform: 'aws-guardduty', enabled: true } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources).toHaveLength(1);
    expect(resources[0].resourceType).toBe('aws:guardduty:Detector');
  });

  it('uses correct naming convention', () => {
    const node = makeNode({
      id: 'platform:guardduty',
      type: 'platform',
      metadata: { properties: { platform: 'aws-guardduty' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].name).toBe('guardduty-guardduty-detector');
  });

  it('defaults to enabled with S3 data source', () => {
    const node = makeNode({
      id: 'platform:guardduty',
      type: 'platform',
      metadata: { properties: { platform: 'aws-guardduty' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].properties['enable']).toBe(true);
    expect(resources[0].properties['findingPublishingFrequency']).toBe(
      'FIFTEEN_MINUTES',
    );
  });

  it('sets correct tags', () => {
    const node = makeNode({
      id: 'platform:guardduty',
      type: 'platform',
      metadata: { properties: { platform: 'aws-guardduty' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = resources[0].properties['tags'] as Record<string, string>;
    expect(tags['shinobi:node']).toBe('platform:guardduty');
    expect(tags['shinobi:platform']).toBe('aws-guardduty');
  });

  it('sets sourceId to node ID', () => {
    const node = makeNode({
      id: 'platform:guardduty',
      type: 'platform',
      metadata: { properties: { platform: 'aws-guardduty' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].sourceId).toBe('platform:guardduty');
  });

  it('output is deterministic', () => {
    const node = makeNode({
      id: 'platform:guardduty',
      type: 'platform',
      metadata: { properties: { platform: 'aws-guardduty' } },
    });

    const r1 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const r2 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});

describe('CloudTrailLowerer', () => {
  const lowerer = new CloudTrailLowerer();

  it('has correct platform', () => {
    expect(lowerer.platform).toBe('aws-cloudtrail');
  });

  it('produces Trail + LogGroup by default', () => {
    const node = makeNode({
      id: 'platform:cloudtrail',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-cloudtrail',
          enableLogFileValidation: true,
        },
      },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources).toHaveLength(2);
    expect(resources[0].resourceType).toBe('aws:cloudwatch:LogGroup');
    expect(resources[1].resourceType).toBe('aws:cloudtrail:Trail');
  });

  it('uses correct naming convention', () => {
    const node = makeNode({
      id: 'platform:cloudtrail',
      type: 'platform',
      metadata: { properties: { platform: 'aws-cloudtrail' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].name).toBe('cloudtrail-trail-log-group');
    expect(resources[1].name).toBe('cloudtrail-trail');
  });

  it('trail depends on log group', () => {
    const node = makeNode({
      id: 'platform:cloudtrail',
      type: 'platform',
      metadata: { properties: { platform: 'aws-cloudtrail' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[1].dependsOn).toContain('cloudtrail-trail-log-group');
  });

  it('defaults to multi-region with log validation', () => {
    const node = makeNode({
      id: 'platform:cloudtrail',
      type: 'platform',
      metadata: { properties: { platform: 'aws-cloudtrail' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const trail = resources[1].properties;
    expect(trail['isMultiRegionTrail']).toBe(true);
    expect(trail['enableLogFileValidation']).toBe(true);
    expect(trail['includeGlobalServiceEvents']).toBe(true);
  });

  it('skips log group when cloudwatch disabled', () => {
    const node = makeNode({
      id: 'platform:cloudtrail',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-cloudtrail',
          cloudWatchLogsEnabled: false,
        },
      },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources).toHaveLength(1);
    expect(resources[0].resourceType).toBe('aws:cloudtrail:Trail');
    expect(resources[0].dependsOn).toHaveLength(0);
  });

  it('sets correct tags', () => {
    const node = makeNode({
      id: 'platform:cloudtrail',
      type: 'platform',
      metadata: { properties: { platform: 'aws-cloudtrail' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = resources[1].properties['tags'] as Record<string, string>;
    expect(tags['shinobi:node']).toBe('platform:cloudtrail');
    expect(tags['shinobi:platform']).toBe('aws-cloudtrail');
  });

  it('sets sourceId to node ID', () => {
    const node = makeNode({
      id: 'platform:cloudtrail',
      type: 'platform',
      metadata: { properties: { platform: 'aws-cloudtrail' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    for (const r of resources) {
      expect(r.sourceId).toBe('platform:cloudtrail');
    }
  });

  it('output is deterministic', () => {
    const node = makeNode({
      id: 'platform:cloudtrail',
      type: 'platform',
      metadata: { properties: { platform: 'aws-cloudtrail' } },
    });

    const r1 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const r2 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it('passes custom tags', () => {
    const node = makeNode({
      id: 'platform:cloudtrail',
      type: 'platform',
      metadata: {
        properties: { platform: 'aws-cloudtrail', tags: { env: 'prod' } },
      },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = resources[1].properties['tags'] as Record<string, string>;
    expect(tags['env']).toBe('prod');
  });
});
