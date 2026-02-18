import type { Node } from '@shinobi/ir';
import type { LoweredResource, LoweringContext, NodeLowerer, ResolvedDeps } from '../types';
import { shortName } from './utils';

/**
 * Lowers a platform node with platform "aws-dynamodb" → DynamoDB Table resource.
 */
export class DynamoDbLowerer implements NodeLowerer {
  readonly platform = 'aws-dynamodb';

  lower(node: Node, context: LoweringContext, _resolvedDeps: ResolvedDeps): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const props = node.metadata.properties;

    const resources: LoweredResource[] = [];

    // Build key schema
    const keySchema = props['keySchema'] as
      | { hashKey: { name: string; type: string }; rangeKey?: { name: string; type: string } }
      | undefined;

    const hashKey = keySchema?.hashKey ?? { name: 'id', type: 'S' };

    // Build attribute definitions
    const attributes: Array<{ name: string; type: string }> = [];
    attributes.push({ name: hashKey.name, type: hashKey.type });

    if (keySchema?.rangeKey) {
      attributes.push({ name: keySchema.rangeKey.name, type: keySchema.rangeKey.type });
    }

    // DynamoDB Table
    resources.push({
      name: `${name}-table`,
      resourceType: 'aws:dynamodb:Table',
      properties: {
        name: `${context.adapterConfig.serviceName}-${name}`,
        billingMode: (props['billingMode'] as string) ?? 'PAY_PER_REQUEST',
        hashKey: hashKey.name,
        ...(keySchema?.rangeKey ? { rangeKey: keySchema.rangeKey.name } : {}),
        attributes: attributes.map((a) => ({ name: a.name, type: a.type })),
        tags: {
          'shinobi:node': node.id,
          'shinobi:platform': 'aws-dynamodb',
        },
      },
      sourceId: node.id,
      dependsOn: [],
    });

    return resources;
  }
}
