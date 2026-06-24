import type { Node } from '@shinobi/ir';
import type { LoweredResource, LoweringContext, NodeLowerer, ResolvedDeps } from '../types';
import { shortName, createStandardTags } from './utils';

/**
 * Lowers a platform node with platform "aws-sagemaker-batch-transform" →
 * SageMaker Model definition.
 *
 * Note: Batch Transform jobs are runtime operations. This lowerer creates
 * the SageMaker Model + IAM role. Step Functions invokes CreateTransformJob
 * at runtime.
 */
export class SageMakerBatchTransformLowerer implements NodeLowerer {
  readonly platform = 'aws-sagemaker-batch-transform';

  lower(node: Node, context: LoweringContext, _resolvedDeps: ResolvedDeps): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const props = node.metadata.properties;
    const serviceName = context.adapterConfig.serviceName;
    const extraTags = (props['tags'] as Record<string, string>) ?? {};

    const resources: LoweredResource[] = [];

    const modelName = `${name}-model`;

    const modelProperties: Record<string, unknown> = {
      name: `${serviceName}-${name}`,
      executionRoleArn: props['executionRoleArn'] ?? { ref: `${name}-exec-role` },
      tags: createStandardTags(node.id, 'aws-sagemaker-batch-transform', extraTags),
    };

    // Primary container configuration
    const primaryContainer: Record<string, unknown> = {};
    if (props['modelImage']) {
      primaryContainer['image'] = props['modelImage'];
    }
    if (props['modelDataUrl']) {
      primaryContainer['modelDataUrl'] = props['modelDataUrl'];
    }
    if (Object.keys(primaryContainer).length > 0) {
      modelProperties['primaryContainer'] = primaryContainer;
    }

    // VPC configuration
    if (props['vpcConfig']) {
      modelProperties['vpcConfig'] = props['vpcConfig'];
    }

    resources.push({
      name: modelName,
      resourceType: 'aws:sagemaker:Model',
      properties: modelProperties,
      sourceId: node.id,
      dependsOn: [],
    });

    return resources;
  }
}
