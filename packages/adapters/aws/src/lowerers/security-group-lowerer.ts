import type { Node } from '@shinobi/ir';
import type { LoweredResource, LoweringContext, NodeLowerer, ResolvedDeps } from '../types';
import { shortName, createStandardTags } from './utils';

interface SgRule {
  protocol: string;
  fromPort?: number;
  toPort?: number;
  cidrBlocks?: string[];
  sourceSecurityGroupId?: string;
}

/**
 * Lowers a platform node with platform "aws-security-group" → Security Group + ingress/egress rules.
 */
export class SecurityGroupLowerer implements NodeLowerer {
  readonly platform = 'aws-security-group';

  lower(node: Node, context: LoweringContext, _resolvedDeps: ResolvedDeps): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const config = node.metadata.properties;
    const extraTags = config['tags'] as Record<string, string> | undefined;
    const tags = createStandardTags(node.id, 'aws-security-group', extraTags);

    const vpcRefName = config['vpcId'] as string | undefined;
    const vpcId = vpcRefName ? { ref: `${shortName(vpcRefName)}-vpc` } : { ref: 'default-vpc' };
    const description = (config['description'] as string | undefined) ?? 'Managed by Shinobi';

    const resources: LoweredResource[] = [];

    resources.push({
      name: `${name}-sg`,
      resourceType: 'aws:ec2:SecurityGroup',
      properties: { description, vpcId, tags },
      sourceId: node.id,
      dependsOn: [],
    });

    // Ingress rules
    const ingressRules = (config['ingressRules'] as SgRule[] | undefined) ?? [];

    ingressRules.forEach((rule, index) => {
      const props: Record<string, unknown> = {
        securityGroupId: { ref: `${name}-sg` },
        resourceType: 'ingress',
        protocol: rule.protocol,
        fromPort: rule.fromPort,
        toPort: rule.toPort,
      };
      if (rule.cidrBlocks) {
        props['cidrBlocks'] = rule.cidrBlocks;
      }
      if (rule.sourceSecurityGroupId) {
        props['sourceSecurityGroupId'] = { ref: `${shortName(rule.sourceSecurityGroupId)}-sg` };
      }

      resources.push({
        name: `${name}-ingress-${index}`,
        resourceType: 'aws:ec2:SecurityGroupRule',
        properties: props,
        sourceId: node.id,
        dependsOn: [`${name}-sg`],
      });
    });

    // Default egress rule: allow all outbound
    resources.push({
      name: `${name}-egress-all`,
      resourceType: 'aws:ec2:SecurityGroupRule',
      properties: {
        securityGroupId: { ref: `${name}-sg` },
        resourceType: 'egress',
        protocol: '-1',
        fromPort: 0,
        toPort: 0,
        cidrBlocks: ['0.0.0.0/0'],
      },
      sourceId: node.id,
      dependsOn: [`${name}-sg`],
    });

    return resources;
  }
}
