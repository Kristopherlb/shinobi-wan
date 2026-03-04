import type { Node } from '@shinobi/ir';
import type { LoweredResource, LoweringContext, NodeLowerer, ResolvedDeps } from '../types';
import { shortName, createStandardTags } from './utils';

/**
 * Lowers a platform node with platform "aws-secretsmanager" →
 * SecretsManager Secret + optional rotation schedule.
 */
export class SecretsManagerLowerer implements NodeLowerer {
  readonly platform = 'aws-secretsmanager';

  lower(node: Node, context: LoweringContext, _resolvedDeps: ResolvedDeps): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const props = node.metadata.properties;
    const serviceName = context.adapterConfig.serviceName;
    const extraTags = (props['tags'] as Record<string, string>) ?? {};

    const resources: LoweredResource[] = [];

    const secretName = `${name}-secret`;

    const secretProperties: Record<string, unknown> = {
      name: `${serviceName}-${name}`,
      tags: createStandardTags(node.id, 'aws-secretsmanager', extraTags),
    };

    // KMS key reference for encryption
    if (props['kmsKeyId']) {
      secretProperties['kmsKeyId'] = { ref: `${shortName(props['kmsKeyId'] as string)}-key` };
    }

    resources.push({
      name: secretName,
      resourceType: 'aws:secretsmanager:Secret',
      properties: secretProperties,
      sourceId: node.id,
      dependsOn: props['kmsKeyId'] ? [`${shortName(props['kmsKeyId'] as string)}-key`] : [],
    });

    // Optional rotation schedule
    if (props['rotationEnabled'] === true) {
      const rotationDays = (props['rotationDays'] as number) ?? 30;
      resources.push({
        name: `${name}-secret-rotation`,
        resourceType: 'aws:secretsmanager:SecretRotation',
        properties: {
          secretId: { ref: secretName },
          rotationRules: {
            automaticallyAfterDays: rotationDays,
          },
          tags: createStandardTags(node.id, 'aws-secretsmanager', extraTags),
        },
        sourceId: node.id,
        dependsOn: [secretName],
      });
    }

    return resources;
  }
}
