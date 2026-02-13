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
 * Lowers a component node with platform "aws-lambda" → Lambda Function resource.
 */
export class LambdaLowerer implements NodeLowerer {
  readonly platform = 'aws-lambda';

  lower(node: Node, context: LoweringContext, resolvedDeps: ResolvedDeps): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const props = node.metadata.properties;

    const resources: LoweredResource[] = [];

    // Lambda Function
    const functionResource: LoweredResource = {
      name: `${name}-function`,
      resourceType: 'aws:lambda:Function',
      properties: {
        functionName: `${context.adapterConfig.serviceName}-${name}`,
        runtime: (props['runtime'] as string) ?? 'nodejs20.x',
        handler: (props['handler'] as string) ?? 'index.handler',
        memorySize: (props['memorySize'] as number) ?? 128,
        timeout: (props['timeout'] as number) ?? 30,
        role: resolvedDeps.roleName ? { ref: resolvedDeps.roleName } : undefined,
        ...(context.adapterConfig.codePath
          ? { code: { path: context.adapterConfig.codePath } }
          : {}),
        ...(context.adapterConfig.codeS3
          ? { s3Bucket: context.adapterConfig.codeS3.bucket, s3Key: context.adapterConfig.codeS3.key }
          : {}),
        environment: Object.keys(resolvedDeps.envVars).length > 0
          ? { variables: resolvedDeps.envVars }
          : undefined,
        tags: {
          'shinobi:node': node.id,
          'shinobi:platform': 'aws-lambda',
        },
      },
      sourceId: node.id,
      dependsOn: resolvedDeps.roleName ? [resolvedDeps.roleName] : [],
    };

    resources.push(functionResource);

    return resources;
  }
}
