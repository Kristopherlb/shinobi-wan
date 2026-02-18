import type { Node } from '@shinobi/ir';
import type { LoweredResource, LoweringContext, NodeLowerer, ResolvedDeps } from '../types';
import { shortName } from './utils';

/**
 * Lowers a platform node with platform "aws-s3" → S3 Bucket (+ optional versioning).
 */
export class S3Lowerer implements NodeLowerer {
  readonly platform = 'aws-s3';

  lower(node: Node, context: LoweringContext, _resolvedDeps: ResolvedDeps): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const props = node.metadata.properties;

    const resources: LoweredResource[] = [];

    const bucketName = `${name}-bucket`;

    // S3 Bucket
    resources.push({
      name: bucketName,
      resourceType: 'aws:s3:Bucket',
      properties: {
        bucket: `${context.adapterConfig.serviceName}-${name}`,
        tags: {
          'shinobi:node': node.id,
          'shinobi:platform': 'aws-s3',
        },
      },
      sourceId: node.id,
      dependsOn: [],
    });

    // Optional versioning
    if (props['versioning'] === true) {
      resources.push({
        name: `${name}-versioning`,
        resourceType: 'aws:s3:BucketVersioningV2',
        properties: {
          bucket: { ref: bucketName },
          versioningConfiguration: {
            status: 'Enabled',
          },
        },
        sourceId: node.id,
        dependsOn: [bucketName],
      });
    }

    return resources;
  }
}
