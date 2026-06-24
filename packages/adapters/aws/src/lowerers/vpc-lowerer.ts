import type { Node } from '@shinobi/ir';
import type { LoweredResource, LoweringContext, NodeLowerer, ResolvedDeps } from '../types';
import { shortName, createStandardTags } from './utils';

/**
 * Lowers a platform node with platform "aws-vpc" → VPC, Internet Gateway, and IGW Attachment resources.
 */
export class VpcLowerer implements NodeLowerer {
  readonly platform = 'aws-vpc';

  lower(node: Node, context: LoweringContext, _resolvedDeps: ResolvedDeps): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const config = node.metadata.properties;
    const extraTags = config['tags'] as Record<string, string> | undefined;
    const tags = createStandardTags(node.id, 'aws-vpc', extraTags);

    const cidrBlock = (config['cidrBlock'] as string | undefined) ?? '10.0.0.0/16';
    const enableDnsHostnames = config['enableDnsHostnames'] !== undefined
      ? (config['enableDnsHostnames'] as boolean)
      : true;
    const enableDnsSupport = config['enableDnsSupport'] !== undefined
      ? (config['enableDnsSupport'] as boolean)
      : true;

    const resources: LoweredResource[] = [];

    resources.push({
      name: `${name}-vpc`,
      resourceType: 'aws:ec2:Vpc',
      properties: {
        cidrBlock,
        enableDnsSupport,
        enableDnsHostnames,
        tags,
      },
      sourceId: node.id,
      dependsOn: [],
    });

    resources.push({
      name: `${name}-igw`,
      resourceType: 'aws:ec2:InternetGateway',
      properties: { tags },
      sourceId: node.id,
      dependsOn: [],
    });

    resources.push({
      name: `${name}-igw-attachment`,
      resourceType: 'aws:ec2:InternetGatewayAttachment',
      properties: {
        vpcId: { ref: `${name}-vpc` },
        internetGatewayId: { ref: `${name}-igw` },
      },
      sourceId: node.id,
      dependsOn: [`${name}-vpc`, `${name}-igw`],
    });

    return resources;
  }
}
