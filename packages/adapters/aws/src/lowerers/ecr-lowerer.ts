import type { Node } from '@shinobi/ir';
import type {
  LoweredResource,
  LoweringContext,
  NodeLowerer,
  ResolvedDeps,
} from '../types';
import { shortName, createStandardTags, makeResourceName } from './utils';

/**
 * Lowers a platform node with platform "aws-ecr" → ECR Repository (+ optional lifecycle policy).
 */
export class EcrLowerer implements NodeLowerer {
  readonly platform = 'aws-ecr';

  lower(
    node: Node,
    context: LoweringContext,
    _resolvedDeps: ResolvedDeps,
  ): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const props = node.metadata.properties;
    const extraTags = props['tags'] as Record<string, string> | undefined;

    const resources: LoweredResource[] = [];

    const repoName = `${name}-repo`;

    // ECR Repository
    resources.push({
      name: repoName,
      resourceType: 'aws:ecr:Repository',
      properties: {
        name: makeResourceName(node.id, context.adapterConfig.serviceName),
        imageTagMutability:
          (props['imageTagMutability'] as string) ?? 'IMMUTABLE',
        imageScanningConfiguration: {
          scanOnPush:
            props['scanOnPush'] !== undefined
              ? (props['scanOnPush'] as boolean)
              : true,
        },
        tags: createStandardTags(node.id, 'aws-ecr', extraTags),
      },
      sourceId: node.id,
      dependsOn: [],
    });

    // Optional lifecycle policy
    if (props['lifecyclePolicy'] !== false) {
      const imageCount =
        (props['lifecycleImageCount'] as number | undefined) ?? 10;
      const lifecyclePolicy = {
        rules: [
          {
            rulePriority: 1,
            description: `Keep last ${imageCount} images`,
            selection: {
              tagStatus: 'any',
              countType: 'imageCountMoreThan',
              countNumber: imageCount,
            },
            action: {
              type: 'expire',
            },
          },
        ],
      };

      resources.push({
        name: `${name}-lifecycle`,
        resourceType: 'aws:ecr:LifecyclePolicy',
        properties: {
          repository: { ref: `${repoName}.name` },
          policy: JSON.stringify(lifecyclePolicy),
        },
        sourceId: node.id,
        dependsOn: [repoName],
      });
    }

    return resources;
  }
}
