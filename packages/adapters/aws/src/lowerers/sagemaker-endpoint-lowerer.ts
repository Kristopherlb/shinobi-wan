import type { Node } from '@shinobi/ir';
import type {
  LoweredResource,
  LoweringContext,
  NodeLowerer,
  ResolvedDeps,
} from '../types';
import { shortName, createStandardTags } from './utils';

/**
 * Lowers a platform node with platform "aws-sagemaker-endpoint" →
 * SageMaker Model + EndpointConfiguration + Endpoint.
 */
export class SageMakerEndpointLowerer implements NodeLowerer {
  readonly platform = 'aws-sagemaker-endpoint';

  lower(
    node: Node,
    context: LoweringContext,
    _resolvedDeps: ResolvedDeps,
  ): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const props = node.metadata.properties;
    const serviceName = context.adapterConfig.serviceName;
    const extraTags = (props['tags'] as Record<string, string>) ?? {};

    const resources: LoweredResource[] = [];

    const modelName = `${name}-sm-model`;
    const endpointConfigName = `${name}-sm-endpoint-config`;
    const endpointName = `${name}-sm-endpoint`;

    const instanceType = (props['instanceType'] as string) ?? 'ml.m5.large';
    const initialInstanceCount = (props['initialInstanceCount'] as number) ?? 1;
    const variantName = (props['variantName'] as string) ?? 'AllTraffic';

    // SageMaker Model
    const modelProperties: Record<string, unknown> = {
      name: `${serviceName}-${name}-model`,
      tags: createStandardTags(node.id, 'aws-sagemaker-endpoint', extraTags),
    };

    if (props['modelImage']) {
      modelProperties['primaryContainer'] = {
        image: props['modelImage'],
        ...(props['modelDataUrl']
          ? { modelDataUrl: props['modelDataUrl'] }
          : {}),
      };
    }

    if (props['executionRoleArn']) {
      modelProperties['executionRoleArn'] = props['executionRoleArn'];
    }

    const vpcConfig = props['vpcConfig'] as Record<string, unknown> | undefined;
    if (vpcConfig) {
      modelProperties['vpcConfig'] = vpcConfig;
    }

    resources.push({
      name: modelName,
      resourceType: 'aws:sagemaker:Model',
      properties: modelProperties,
      sourceId: node.id,
      dependsOn: [],
    });

    // Endpoint Configuration
    resources.push({
      name: endpointConfigName,
      resourceType: 'aws:sagemaker:EndpointConfiguration',
      properties: {
        name: `${serviceName}-${name}-config`,
        productionVariants: [
          {
            modelName: { ref: modelName },
            variantName,
            instanceType,
            initialInstanceCount,
          },
        ],
        tags: createStandardTags(node.id, 'aws-sagemaker-endpoint', extraTags),
      },
      sourceId: node.id,
      dependsOn: [modelName],
    });

    // Endpoint
    resources.push({
      name: endpointName,
      resourceType: 'aws:sagemaker:Endpoint',
      properties: {
        name: `${serviceName}-${name}`,
        endpointConfigName: { ref: endpointConfigName },
        tags: createStandardTags(node.id, 'aws-sagemaker-endpoint', extraTags),
      },
      sourceId: node.id,
      dependsOn: [endpointConfigName],
    });

    return resources;
  }
}
