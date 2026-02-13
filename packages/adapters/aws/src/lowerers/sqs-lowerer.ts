import type { Node } from '@shinobi/ir';
import type { LoweredResource, LoweringContext, NodeLowerer, ResolvedDeps } from '../types';

/**
 * Extracts a short name from a kernel node ID.
 */
function shortName(nodeId: string): string {
  const idx = nodeId.indexOf(':');
  return idx >= 0 ? nodeId.substring(idx + 1) : nodeId;
}

/**
 * Lowers a platform node with platform "aws-sqs" → SQS Queue resource.
 */
export class SqsLowerer implements NodeLowerer {
  readonly platform = 'aws-sqs';

  lower(node: Node, context: LoweringContext, _resolvedDeps: ResolvedDeps): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const props = node.metadata.properties;

    const resources: LoweredResource[] = [];

    // SQS Queue
    resources.push({
      name: `${name}-queue`,
      resourceType: 'aws:sqs:Queue',
      properties: {
        name: `${context.adapterConfig.serviceName}-${name}`,
        visibilityTimeoutSeconds: (props['visibilityTimeout'] as number) ?? 30,
        messageRetentionSeconds: (props['messageRetention'] as number) ?? 345600,
        tags: {
          'shinobi:node': node.id,
          'shinobi:platform': 'aws-sqs',
        },
      },
      sourceId: node.id,
      dependsOn: [],
    });

    return resources;
  }
}
