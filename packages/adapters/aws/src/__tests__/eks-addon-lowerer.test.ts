import { describe, it, expect } from 'vitest';
import { createTestNode } from '@shinobi/ir';
import { makeDefaultContext, makeDefaultDeps } from './test-helpers';
import { EksAddonLowerer } from '../lowerers/eks-addon-lowerer';

const DEFAULT_CONTEXT = makeDefaultContext();
const DEFAULT_DEPS = makeDefaultDeps();

describe('EksAddonLowerer', () => {
  const lowerer = new EksAddonLowerer();

  it('should emit 1 resource (addon)', () => {
    const node = createTestNode({
      id: 'platform:vpc-cni-addon',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-eks-addon',
          clusterRef: 'platform:llm-cluster',
          addonName: 'vpc-cni',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result).toHaveLength(1);
    expect(result[0]?.resourceType).toBe('aws:eks:Addon');
    expect(result[0]?.name).toBe('vpc-cni-addon-addon');
  });

  it('should resolve cluster ref', () => {
    const node = createTestNode({
      id: 'platform:addon',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-eks-addon',
          clusterRef: 'platform:my-cluster',
          addonName: 'coredns',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.clusterName).toEqual({ ref: 'my-cluster-cluster.name' });
  });

  it('should set addon name', () => {
    const node = createTestNode({
      id: 'platform:addon',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-eks-addon',
          addonName: 'kube-proxy',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.addonName).toBe('kube-proxy');
  });

  it('should default resolveConflicts to OVERWRITE', () => {
    const node = createTestNode({
      id: 'platform:addon',
      type: 'platform',
      metadata: { properties: { platform: 'aws-eks-addon', addonName: 'vpc-cni' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.resolveConflicts).toBe('OVERWRITE');
  });

  it('should include addon version when provided', () => {
    const node = createTestNode({
      id: 'platform:addon',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-eks-addon',
          addonName: 'vpc-cni',
          addonVersion: 'v1.15.0-eksbuild.2',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.addonVersion).toBe('v1.15.0-eksbuild.2');
  });

  it('should omit addon version when not provided', () => {
    const node = createTestNode({
      id: 'platform:addon',
      type: 'platform',
      metadata: { properties: { platform: 'aws-eks-addon', addonName: 'coredns' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.addonVersion).toBeUndefined();
  });

  it('should include configuration values when provided', () => {
    const node = createTestNode({
      id: 'platform:addon',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-eks-addon',
          addonName: 'vpc-cni',
          configurationValues: '{"env":{"ENABLE_PREFIX_DELEGATION":"true"}}',
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.configurationValues).toBe('{"env":{"ENABLE_PREFIX_DELEGATION":"true"}}');
  });

  it('should include standard tags', () => {
    const node = createTestNode({
      id: 'platform:addon',
      type: 'platform',
      metadata: { properties: { platform: 'aws-eks-addon', addonName: 'coredns' } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = result[0]?.properties?.tags as Record<string, string>;
    expect(tags?.['shinobi:platform']).toBe('aws-eks-addon');
  });
});
