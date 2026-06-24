import type { Node } from '@shinobi/ir';
import type { LoweredResource, LoweringContext, NodeLowerer, ResolvedDeps } from '../types';
import { shortName, createStandardTags } from './utils';

/**
 * Lowers a platform node with platform "aws-config-recorder" →
 * Config Recorder + RecorderStatus + DeliveryChannel.
 */
export class ConfigRecorderLowerer implements NodeLowerer {
  readonly platform = 'aws-config-recorder';

  lower(node: Node, context: LoweringContext, _resolvedDeps: ResolvedDeps): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const props = node.metadata.properties;
    const serviceName = context.adapterConfig.serviceName;
    const extraTags = (props['tags'] as Record<string, string>) ?? {};

    const resources: LoweredResource[] = [];

    const recorderName = `${name}-config-recorder`;
    const statusName = `${name}-config-recorder-status`;
    const channelName = `${name}-config-delivery-channel`;

    const allSupported = props['allSupported'] !== false;
    const includeGlobalResourceTypes = props['includeGlobalResourceTypes'] !== false;
    const deliveryFrequency = (props['deliveryFrequency'] as string) ?? 'TwentyFour_Hours';

    // Config Recorder
    const recorderProperties: Record<string, unknown> = {
      name: `${serviceName}-${name}`,
      recordingGroup: {
        allSupported,
        includeGlobalResourceTypes,
      },
    };

    if (props['roleArn']) {
      recorderProperties['roleArn'] = props['roleArn'];
    }

    resources.push({
      name: recorderName,
      resourceType: 'aws:cfg:Recorder',
      properties: recorderProperties,
      sourceId: node.id,
      dependsOn: [],
    });

    // Delivery Channel
    const channelProperties: Record<string, unknown> = {
      name: `${serviceName}-${name}-channel`,
      snapshotDeliveryProperties: {
        deliveryFrequency,
      },
    };

    if (props['s3BucketName']) {
      channelProperties['s3BucketName'] = props['s3BucketName'];
    }
    if (props['snsTopicArn']) {
      channelProperties['snsTopicArn'] = props['snsTopicArn'];
    }

    resources.push({
      name: channelName,
      resourceType: 'aws:cfg:DeliveryChannel',
      properties: channelProperties,
      sourceId: node.id,
      dependsOn: [recorderName],
    });

    // Recorder Status (enable the recorder)
    const recordingEnabled = props['recordingEnabled'] !== false;
    resources.push({
      name: statusName,
      resourceType: 'aws:cfg:RecorderStatus',
      properties: {
        name: { ref: recorderName },
        isEnabled: recordingEnabled,
      },
      sourceId: node.id,
      dependsOn: [recorderName, channelName],
    });

    return resources;
  }
}
