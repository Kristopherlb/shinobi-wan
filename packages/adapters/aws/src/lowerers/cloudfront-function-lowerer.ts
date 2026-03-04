import type { Node } from '@shinobi/ir';
import type { LoweredResource, LoweringContext, NodeLowerer, ResolvedDeps } from '../types';
import { shortName, createStandardTags } from './utils';

/**
 * Lowers a platform node with platform "aws-cloudfront-function" → CloudFront Function.
 *
 * Emits:
 *   - Function (viewer-request or viewer-response)
 */
export class CloudFrontFunctionLowerer implements NodeLowerer {
  readonly platform = 'aws-cloudfront-function';

  lower(node: Node, context: LoweringContext, _resolvedDeps: ResolvedDeps): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const props = node.metadata.properties;
    const serviceName = context.adapterConfig.serviceName;

    const resources: LoweredResource[] = [];

    const funcName = `${name}-cf-function`;

    const runtime = (props['runtime'] as string) ?? 'cloudfront-js-2.0';
    const code = (props['code'] as string) ?? '// placeholder';
    const comment = (props['comment'] as string) ?? `${serviceName}-${name}`;

    resources.push({
      name: funcName,
      resourceType: 'aws:cloudfront:Function',
      properties: {
        name: `${serviceName}-${name}`,
        runtime,
        code,
        comment,
        publish: true,
        tags: createStandardTags(node.id, 'aws-cloudfront-function'),
      },
      sourceId: node.id,
      dependsOn: [],
    });

    return resources;
  }
}
