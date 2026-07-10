import type { Node } from '@shinobi/ir';
import type {
  LoweredResource,
  LoweringContext,
  NodeLowerer,
  ResolvedDeps,
} from '../types';
import { shortName, createStandardTags, makeResourceName } from './utils';

/**
 * Lowers a platform node with platform "aws-eks-node-group" → EKS Managed Node Group.
 */
export class EksNodeGroupLowerer implements NodeLowerer {
  readonly platform = 'aws-eks-node-group';

  lower(
    node: Node,
    context: LoweringContext,
    _resolvedDeps: ResolvedDeps,
  ): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const config = node.metadata.properties;
    const extraTags = config['tags'] as Record<string, string> | undefined;
    const tags = createStandardTags(node.id, 'aws-eks-node-group', extraTags);

    const nodeGroupName = `${name}-node-group`;

    // Cluster ref
    const clusterName = config['clusterName'] as string | undefined;
    const clusterRef = clusterName
      ? { ref: `${shortName(clusterName)}-cluster.name` }
      : undefined;

    // Build subnet refs
    const subnetIds = Array.isArray(config['subnetIds'])
      ? (config['subnetIds'] as string[]).map((s) => ({
          ref: `${shortName(s)}-subnet`,
        }))
      : [];

    const instanceTypes = Array.isArray(config['instanceTypes'])
      ? (config['instanceTypes'] as string[])
      : ['t3.medium'];

    const scalingConfig = (config['scalingConfig'] as
      | Record<string, number>
      | undefined) ?? {
      desiredSize: 2,
      minSize: 1,
      maxSize: 4,
    };

    const amiType = (config['amiType'] as string | undefined) ?? 'AL2_x86_64';
    const diskSize = (config['diskSize'] as number | undefined) ?? 20;

    const properties: Record<string, unknown> = {
      nodeGroupName: makeResourceName(
        node.id,
        context.adapterConfig.serviceName,
      ),
      clusterName: clusterRef,
      subnetIds,
      instanceTypes,
      scalingConfig,
      amiType,
      diskSize,
      tags,
    };

    // Optional IAM role ref
    if (config['nodeRoleArn']) {
      properties.nodeRoleArn = config['nodeRoleArn'];
    }

    return [
      {
        name: nodeGroupName,
        resourceType: 'aws:eks:NodeGroup',
        properties,
        sourceId: node.id,
        dependsOn: [],
      },
    ];
  }
}
