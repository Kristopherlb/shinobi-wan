import type { Node } from '@shinobi/ir';
import type {
  LoweredResource,
  LoweringContext,
  NodeLowerer,
  ResolvedDeps,
} from '../types';
import { shortName, createStandardTags } from './utils';

/**
 * Lowers a platform node with platform "aws-subnet" → Subnet, Route Table, and Route Table Association.
 */
export class SubnetLowerer implements NodeLowerer {
  readonly platform = 'aws-subnet';

  lower(
    node: Node,
    context: LoweringContext,
    _resolvedDeps: ResolvedDeps,
  ): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const config = node.metadata.properties;
    const extraTags = config['tags'] as Record<string, string> | undefined;
    const tags = createStandardTags(node.id, 'aws-subnet', extraTags);

    const vpcRefName = config['vpcId'] as string | undefined;
    const vpcId = vpcRefName
      ? { ref: `${shortName(vpcRefName)}-vpc` }
      : { ref: 'default-vpc' };
    const cidrBlock =
      (config['cidrBlock'] as string | undefined) ?? '10.0.1.0/24';
    const availabilityZone = config['availabilityZone'] as string | undefined;
    const mapPublicIpOnLaunch =
      (config['mapPublicIpOnLaunch'] as boolean | undefined) ?? false;

    const resources: LoweredResource[] = [];

    const subnetProps: Record<string, unknown> = {
      vpcId,
      cidrBlock,
      mapPublicIpOnLaunch,
      tags,
    };
    if (availabilityZone) {
      subnetProps['availabilityZone'] = availabilityZone;
    }

    resources.push({
      name: `${name}-subnet`,
      resourceType: 'aws:ec2:Subnet',
      properties: subnetProps,
      sourceId: node.id,
      dependsOn: [],
    });

    resources.push({
      name: `${name}-rt`,
      resourceType: 'aws:ec2:RouteTable',
      properties: { vpcId, tags },
      sourceId: node.id,
      dependsOn: [`${name}-subnet`],
    });

    resources.push({
      name: `${name}-rt-assoc`,
      resourceType: 'aws:ec2:RouteTableAssociation',
      properties: {
        subnetId: { ref: `${name}-subnet` },
        routeTableId: { ref: `${name}-rt` },
      },
      sourceId: node.id,
      dependsOn: [`${name}-subnet`, `${name}-rt`],
    });

    return resources;
  }
}
