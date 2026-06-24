import type { Node } from '@shinobi/ir';
import type { LoweredResource, LoweringContext, NodeLowerer, ResolvedDeps } from '../types';
import { shortName, createStandardTags } from './utils';

/**
 * Lowers a platform node with platform "aws-nat-gateway" ->
 * Elastic IP + NAT Gateway.
 */
export class NatGatewayLowerer implements NodeLowerer {
  readonly platform = 'aws-nat-gateway';

  lower(node: Node, _context: LoweringContext, _resolvedDeps: ResolvedDeps): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const config = node.metadata.properties;
    const extraTags = config['tags'] as Record<string, string> | undefined;
    const tags = createStandardTags(node.id, 'aws-nat-gateway', extraTags);

    const eipName = `${name}-eip`;
    const natName = `${name}-nat`;

    const subnetRef = config['subnetRef'] as string | undefined;
    const connectivityType = (config['connectivityType'] as string) ?? 'public';

    const natProperties: Record<string, unknown> = {
      allocationId: { ref: `${eipName}.allocationId` },
      connectivityType,
      tags,
    };

    if (subnetRef) {
      natProperties.subnetId = { ref: `${shortName(subnetRef)}-subnet` };
    }

    const resources: LoweredResource[] = [];

    resources.push({
      name: eipName,
      resourceType: 'aws:ec2:Eip',
      properties: {
        domain: 'vpc',
        tags,
      },
      sourceId: node.id,
      dependsOn: [],
    });

    resources.push({
      name: natName,
      resourceType: 'aws:ec2:NatGateway',
      properties: natProperties,
      sourceId: node.id,
      dependsOn: [eipName],
    });

    return resources;
  }
}
