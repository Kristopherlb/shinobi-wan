import type { Node } from '@shinobi/ir';
import type { LoweredResource, LoweringContext, NodeLowerer, ResolvedDeps } from '../types';
import { shortName, createStandardTags } from './utils';

/**
 * Lowers a platform node with platform "aws-apigateway" → API Gateway HTTP API + Stage.
 */
export class ApiGatewayLowerer implements NodeLowerer {
  readonly platform = 'aws-apigateway';

  lower(node: Node, context: LoweringContext, _resolvedDeps: ResolvedDeps): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);

    const resources: LoweredResource[] = [];

    const apiName = `${name}-api`;
    const stageName = `${name}-stage`;

    // API Gateway HTTP API
    resources.push({
      name: apiName,
      resourceType: 'aws:apigatewayv2:Api',
      properties: {
        name: `${context.adapterConfig.serviceName}-${name}`,
        protocolType: 'HTTP',
        tags: createStandardTags(node.id, 'aws-apigateway'),
      },
      sourceId: node.id,
      dependsOn: [],
    });

    // Default stage with auto-deploy
    resources.push({
      name: stageName,
      resourceType: 'aws:apigatewayv2:Stage',
      properties: {
        apiId: { ref: apiName },
        name: '$default',
        autoDeploy: true,
        tags: createStandardTags(node.id, 'aws-apigateway'),
      },
      sourceId: node.id,
      dependsOn: [apiName],
    });

    return resources;
  }
}
