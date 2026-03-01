import type { Node } from '@shinobi/ir';
import type { LoweredResource, LoweringContext, NodeLowerer, ResolvedDeps } from '../types';
import { shortName, createStandardTags, makeResourceName } from './utils';

/**
 * Lowers a platform node with platform "aws-ecs-cluster" → ECS Cluster.
 */
export class EcsClusterLowerer implements NodeLowerer {
  readonly platform = 'aws-ecs-cluster';

  lower(node: Node, context: LoweringContext, _resolvedDeps: ResolvedDeps): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const props = node.metadata.properties;
    const extraTags = props['tags'] as Record<string, string> | undefined;

    const clusterName = `${name}-cluster`;

    // Build cluster properties
    const clusterProperties: Record<string, unknown> = {
      name: makeResourceName(node.id, context.adapterConfig.serviceName),
      settings: [
        {
          name: 'containerInsights',
          value: props['containerInsights'] !== false ? 'enabled' : 'disabled',
        },
      ],
      tags: createStandardTags(node.id, 'aws-ecs-cluster', extraTags),
    };

    // Add configuration if executeCommand is enabled
    if (props['executeCommand'] === true) {
      clusterProperties.configuration = { executeCommandConfiguration: {} };
    }

    // Support explicit capacity providers array
    if (Array.isArray(props['capacityProviders'])) {
      clusterProperties.capacityProviders = props['capacityProviders'];
    }

    // Support explicit default capacity provider strategy
    if (Array.isArray(props['defaultCapacityProviderStrategy'])) {
      clusterProperties.defaultCapacityProviderStrategy = props['defaultCapacityProviderStrategy'];
    }

    return [
      {
        name: clusterName,
        resourceType: 'aws:ecs:Cluster',
        properties: clusterProperties,
        sourceId: node.id,
      },
    ];
  }
}
