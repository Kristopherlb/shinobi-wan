import type { Node } from '@shinobi/ir';
import type { LoweredResource, LoweringContext, NodeLowerer, ResolvedDeps } from '../types';
import { shortName, createStandardTags, makeResourceName } from './utils';

/**
 * Lowers a platform node with platform "aws-transit-gateway" ->
 * Transit Gateway + Route Table.
 */
export class TransitGatewayLowerer implements NodeLowerer {
  readonly platform = 'aws-transit-gateway';

  lower(node: Node, context: LoweringContext, _resolvedDeps: ResolvedDeps): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const config = node.metadata.properties;
    const extraTags = config['tags'] as Record<string, string> | undefined;
    const tags = createStandardTags(node.id, 'aws-transit-gateway', extraTags);

    const tgwName = `${name}-tgw`;
    const rtName = `${name}-tgw-rt`;

    const autoAcceptSharedAttachments = (config['autoAcceptSharedAttachments'] as string) ?? 'disable';
    const defaultRouteTableAssociation = (config['defaultRouteTableAssociation'] as string) ?? 'enable';
    const defaultRouteTablePropagation = (config['defaultRouteTablePropagation'] as string) ?? 'enable';
    const dnsSupport = (config['dnsSupport'] as string) ?? 'enable';
    const vpnEcmpSupport = (config['vpnEcmpSupport'] as string) ?? 'enable';
    const amazonSideAsn = (config['amazonSideAsn'] as number) ?? 64512;

    const resources: LoweredResource[] = [];

    resources.push({
      name: tgwName,
      resourceType: 'aws:ec2transitgateway:TransitGateway',
      properties: {
        description: makeResourceName(node.id, context.adapterConfig.serviceName),
        autoAcceptSharedAttachments,
        defaultRouteTableAssociation,
        defaultRouteTablePropagation,
        dnsSupport,
        vpnEcmpSupport,
        amazonSideAsn,
        tags,
      },
      sourceId: node.id,
      dependsOn: [],
    });

    resources.push({
      name: rtName,
      resourceType: 'aws:ec2transitgateway:RouteTable',
      properties: {
        transitGatewayId: { ref: tgwName },
        tags,
      },
      sourceId: node.id,
      dependsOn: [tgwName],
    });

    return resources;
  }
}
