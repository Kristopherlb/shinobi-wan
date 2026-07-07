import { describe, it, expect } from 'vitest';
import { createTestNode } from '@shinobi/ir';
import { makeDefaultContext, makeDefaultDeps } from './test-helpers';
import { Route53ZoneLowerer } from '../lowerers/route53-zone-lowerer';
import { Route53RecordLowerer } from '../lowerers/route53-record-lowerer';

const DEFAULT_CONTEXT = makeDefaultContext();
const DEFAULT_DEPS = makeDefaultDeps();

describe('Route53ZoneLowerer', () => {
  const lowerer = new Route53ZoneLowerer();

  it('should emit 1 resource for public zone without health check', () => {
    const node = createTestNode({
      id: 'platform:dns-zone',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-route53-zone',
          zoneName: 'example.com',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result).toHaveLength(1);
    expect(result[0]?.resourceType).toBe('aws:route53:Zone');
    expect(result[0]?.name).toBe('dns-zone-zone');
  });

  it('should emit 2 resources with health check', () => {
    const node = createTestNode({
      id: 'platform:dns-zone',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-route53-zone',
          zoneName: 'example.com',
          healthCheck: { fqdn: 'example.com', type: 'HTTPS', port: 443 },
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result).toHaveLength(2);
    expect(result[0]?.resourceType).toBe('aws:route53:Zone');
    expect(result[1]?.resourceType).toBe('aws:route53:HealthCheck');
    expect(result[1]?.name).toBe('dns-zone-health-check');
  });

  it('should set zone name to domain', () => {
    const node = createTestNode({
      id: 'platform:zone',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-route53-zone',
          zoneName: 'example.com',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.name).toBe('example.com');
  });

  it('should configure private zone with VPC', () => {
    const node = createTestNode({
      id: 'platform:zone',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-route53-zone',
          zoneName: 'internal.example.com',
          isPrivate: true,
          vpcId: 'platform:hub-vpc',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.vpcs).toEqual([
      { vpcId: { ref: 'hub-vpc-vpc' } },
    ]);
  });

  it('should include health check properties', () => {
    const node = createTestNode({
      id: 'platform:zone',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-route53-zone',
          zoneName: 'example.com',
          healthCheck: {
            fqdn: 'api.example.com',
            type: 'HTTPS',
            port: 443,
            requestInterval: 10,
            failureThreshold: 3,
          },
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const hc = result[1];
    expect(hc?.properties?.fqdn).toBe('api.example.com');
    expect(hc?.properties?.type).toBe('HTTPS');
    expect(hc?.properties?.port).toBe(443);
    expect(hc?.properties?.requestInterval).toBe(10);
    expect(hc?.properties?.failureThreshold).toBe(3);
  });

  it('should include standard tags', () => {
    const node = createTestNode({
      id: 'platform:zone',
      type: 'platform',
      metadata: {
        properties: { platform: 'aws-route53-zone', zoneName: 'example.com' },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = result[0]?.properties?.tags as Record<string, string>;
    expect(tags?.['shinobi:platform']).toBe('aws-route53-zone');
  });
});

describe('Route53RecordLowerer', () => {
  const lowerer = new Route53RecordLowerer();

  it('should emit 1 resource (record)', () => {
    const node = createTestNode({
      id: 'platform:api-record',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-route53-record',
          zoneRef: 'platform:dns-zone',
          recordName: 'api.example.com',
          recordType: 'A',
          records: ['1.2.3.4'],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result).toHaveLength(1);
    expect(result[0]?.resourceType).toBe('aws:route53:Record');
    expect(result[0]?.name).toBe('api-record-record');
  });

  it('should resolve zone ref', () => {
    const node = createTestNode({
      id: 'platform:record',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-route53-record',
          zoneRef: 'platform:dns-zone',
          recordName: 'www.example.com',
          recordType: 'CNAME',
          records: ['example.com'],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.zoneId).toEqual({
      ref: 'dns-zone-zone.zoneId',
    });
  });

  it('should use default TTL of 300', () => {
    const node = createTestNode({
      id: 'platform:record',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-route53-record',
          recordName: 'www.example.com',
          recordType: 'A',
          records: ['1.2.3.4'],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.ttl).toBe(300);
  });

  it('should handle alias records without TTL', () => {
    const node = createTestNode({
      id: 'platform:record',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-route53-record',
          zoneRef: 'platform:dns-zone',
          recordName: 'api.example.com',
          recordType: 'A',
          alias: {
            name: 'dualstack.my-alb.us-east-1.elb.amazonaws.com',
            zoneId: 'Z35SXDOTRQ7X7K',
            evaluateTargetHealth: true,
          },
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.ttl).toBeUndefined();
    expect(result[0]?.properties?.aliases).toBeDefined();
  });

  it('should include standard tags', () => {
    const node = createTestNode({
      id: 'platform:record',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-route53-record',
          recordName: 'test.example.com',
          recordType: 'A',
          records: ['1.2.3.4'],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = result[0]?.properties?.tags as Record<string, string>;
    expect(tags?.['shinobi:platform']).toBe('aws-route53-record');
  });
});
