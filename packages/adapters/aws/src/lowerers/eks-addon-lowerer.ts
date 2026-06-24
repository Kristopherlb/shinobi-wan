import type { Node } from '@shinobi/ir';
import type { LoweredResource, LoweringContext, NodeLowerer, ResolvedDeps } from '../types';
import { shortName, createStandardTags, makeResourceName } from './utils';

/**
 * Lowers a platform node with platform "aws-eks-addon" -> EKS Addon.
 */
export class EksAddonLowerer implements NodeLowerer {
  readonly platform = 'aws-eks-addon';

  lower(node: Node, context: LoweringContext, _resolvedDeps: ResolvedDeps): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const config = node.metadata.properties;
    const extraTags = config['tags'] as Record<string, string> | undefined;
    const tags = createStandardTags(node.id, 'aws-eks-addon', extraTags);

    const addonResourceName = `${name}-addon`;

    const clusterRef = config['clusterRef'] as string | undefined;
    const addonName = config['addonName'] as string | undefined;
    const addonVersion = config['addonVersion'] as string | undefined;
    const resolveConflicts = (config['resolveConflicts'] as string) ?? 'OVERWRITE';
    const serviceAccountRoleArn = config['serviceAccountRoleArn'] as string | undefined;
    const configurationValues = config['configurationValues'] as string | undefined;

    const properties: Record<string, unknown> = {
      addonName,
      resolveConflicts,
      tags,
    };

    if (clusterRef) {
      properties.clusterName = { ref: `${shortName(clusterRef)}-cluster.name` };
    }
    if (addonVersion) properties.addonVersion = addonVersion;
    if (serviceAccountRoleArn) properties.serviceAccountRoleArn = serviceAccountRoleArn;
    if (configurationValues) properties.configurationValues = configurationValues;

    return [
      {
        name: addonResourceName,
        resourceType: 'aws:eks:Addon',
        properties,
        sourceId: node.id,
        dependsOn: [],
      },
    ];
  }
}
