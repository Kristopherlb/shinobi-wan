import type { Node } from '@shinobi/ir';
import type { LoweredResource, LoweringContext, NodeLowerer, ResolvedDeps } from '../types';
import { shortName, createStandardTags } from './utils';

/**
 * Lowers a platform node with platform "aws-cloudtrail" →
 * CloudTrail Trail + optional CloudWatch LogGroup.
 */
export class CloudTrailLowerer implements NodeLowerer {
  readonly platform = 'aws-cloudtrail';

  lower(node: Node, context: LoweringContext, _resolvedDeps: ResolvedDeps): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const props = node.metadata.properties;
    const serviceName = context.adapterConfig.serviceName;
    const extraTags = (props['tags'] as Record<string, string>) ?? {};

    const resources: LoweredResource[] = [];

    const trailName = `${name}-trail`;

    const isMultiRegionTrail = props['isMultiRegionTrail'] !== false;
    const enableLogFileValidation = props['enableLogFileValidation'] !== false;
    const includeGlobalServiceEvents = props['includeGlobalServiceEvents'] !== false;
    const cloudWatchLogsEnabled = props['cloudWatchLogsEnabled'] !== false;
    const logRetentionDays = (props['logRetentionDays'] as number) ?? 90;

    // Optional CloudWatch LogGroup
    if (cloudWatchLogsEnabled) {
      const logGroupName = `${name}-trail-log-group`;
      resources.push({
        name: logGroupName,
        resourceType: 'aws:cloudwatch:LogGroup',
        properties: {
          name: `/aws/cloudtrail/${serviceName}-${name}`,
          retentionInDays: logRetentionDays,
          tags: createStandardTags(node.id, 'aws-cloudtrail', extraTags),
        },
        sourceId: node.id,
        dependsOn: [],
      });
    }

    // CloudTrail Trail
    const trailProperties: Record<string, unknown> = {
      name: `${serviceName}-${name}`,
      isMultiRegionTrail,
      enableLogFileValidation,
      includeGlobalServiceEvents,
      tags: createStandardTags(node.id, 'aws-cloudtrail', extraTags),
    };

    if (props['s3BucketName']) {
      trailProperties['s3BucketName'] = props['s3BucketName'];
    }
    if (props['snsTopicName']) {
      trailProperties['snsTopicName'] = props['snsTopicName'];
    }
    if (props['kmsKeyId']) {
      trailProperties['kmsKeyId'] = props['kmsKeyId'];
    }
    if (cloudWatchLogsEnabled) {
      trailProperties['cloudWatchLogsGroupArn'] = { ref: `${name}-trail-log-group.arn` };
    }

    const trailDeps = cloudWatchLogsEnabled ? [`${name}-trail-log-group`] : [];
    resources.push({
      name: trailName,
      resourceType: 'aws:cloudtrail:Trail',
      properties: trailProperties,
      sourceId: node.id,
      dependsOn: trailDeps,
    });

    return resources;
  }
}
