import type { Node } from '@shinobi/ir';
import type { LoweredResource, LoweringContext, NodeLowerer, ResolvedDeps } from '../types';
import { shortName } from './utils';

/**
 * Lowers a platform node with platform "aws-sqs" → SQS Queue resource.
 * When config.deadLetterQueue is true, also emits a DLQ and sets redrivePolicy.
 */
export class SqsLowerer implements NodeLowerer {
  readonly platform = 'aws-sqs';

  lower(node: Node, context: LoweringContext, _resolvedDeps: ResolvedDeps): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const props = node.metadata.properties;
    const hasDlq = props['deadLetterQueue'] === true;
    const maxReceiveCount = (props['maxReceiveCount'] as number) ?? 3;

    const resources: LoweredResource[] = [];

    // DLQ must be created before the main queue if enabled
    if (hasDlq) {
      resources.push({
        name: `${name}-dlq`,
        resourceType: 'aws:sqs:Queue',
        properties: {
          name: `${context.adapterConfig.serviceName}-${name}-dlq`,
          messageRetentionSeconds: (props['dlqMessageRetention'] as number) ?? 1209600, // 14 days
          tags: {
            'shinobi:node': node.id,
            'shinobi:platform': 'aws-sqs',
            'shinobi:role': 'dead-letter-queue',
          },
        },
        sourceId: node.id,
        dependsOn: [],
      });
    }

    // Main SQS Queue
    resources.push({
      name: `${name}-queue`,
      resourceType: 'aws:sqs:Queue',
      properties: {
        name: `${context.adapterConfig.serviceName}-${name}`,
        visibilityTimeoutSeconds: (props['visibilityTimeout'] as number) ?? 30,
        messageRetentionSeconds: (props['messageRetention'] as number) ?? 345600,
        ...(hasDlq
          ? {
              redrivePolicy: JSON.stringify({
                deadLetterTargetArn: { ref: `${name}-dlq` },
                maxReceiveCount,
              }),
            }
          : {}),
        tags: {
          'shinobi:node': node.id,
          'shinobi:platform': 'aws-sqs',
        },
      },
      sourceId: node.id,
      dependsOn: hasDlq ? [`${name}-dlq`] : [],
    });

    return resources;
  }
}
