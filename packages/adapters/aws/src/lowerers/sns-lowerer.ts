import type { Node } from '@shinobi/ir';
import type { LoweredResource, LoweringContext, NodeLowerer, ResolvedDeps } from '../types';
import { shortName } from './utils';

/**
 * Lowers a platform node with platform "aws-sns" → SNS Topic resource.
 */
export class SnsLowerer implements NodeLowerer {
  readonly platform = 'aws-sns';

  lower(node: Node, context: LoweringContext, _resolvedDeps: ResolvedDeps): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);

    const resources: LoweredResource[] = [];

    // SNS Topic
    resources.push({
      name: `${name}-topic`,
      resourceType: 'aws:sns:Topic',
      properties: {
        name: `${context.adapterConfig.serviceName}-${name}`,
        tags: {
          'shinobi:node': node.id,
          'shinobi:platform': 'aws-sns',
        },
      },
      sourceId: node.id,
      dependsOn: [],
    });

    return resources;
  }
}
