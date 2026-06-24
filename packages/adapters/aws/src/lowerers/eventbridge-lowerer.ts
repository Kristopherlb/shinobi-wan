import type { Node } from '@shinobi/ir';
import type { LoweredResource, LoweringContext, NodeLowerer, ResolvedDeps } from '../types';
import { shortName, createStandardTags } from './utils';

/**
 * Lowers a platform node with platform "aws-eventbridge-scheduler" →
 * EventBridge Scheduler Schedule + ScheduleGroup resources.
 */
export class EventBridgeLowerer implements NodeLowerer {
  readonly platform = 'aws-eventbridge-scheduler';

  lower(node: Node, context: LoweringContext, _resolvedDeps: ResolvedDeps): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const props = node.metadata.properties;

    const resources: LoweredResource[] = [];

    // Schedule Group
    const groupName = `${name}-schedule-group`;
    resources.push({
      name: groupName,
      resourceType: 'aws:scheduler:ScheduleGroup',
      properties: {
        name: `${context.adapterConfig.serviceName}-${name}`,
        tags: createStandardTags(node.id, 'aws-eventbridge-scheduler'),
      },
      sourceId: node.id,
      dependsOn: [],
    });

    // Schedule
    const scheduleExpression = (props['scheduleExpression'] as string) ?? 'rate(1 hour)';
    const flexibleTimeWindow = (props['flexibleTimeWindow'] as string) ?? 'OFF';
    const state = (props['enabled'] as boolean) === false ? 'DISABLED' : 'ENABLED';

    resources.push({
      name: `${name}-schedule`,
      resourceType: 'aws:scheduler:Schedule',
      properties: {
        name: `${context.adapterConfig.serviceName}-${name}`,
        groupName: { ref: groupName },
        scheduleExpression,
        flexibleTimeWindow: { mode: flexibleTimeWindow },
        state,
        ...(props['retryPolicy'] !== undefined
          ? {
              retryPolicy: {
                maximumRetryAttempts: (props['retryPolicy'] as Record<string, unknown>)?.['maximumRetryAttempts'] ?? 2,
                maximumEventAgeInSeconds: (props['retryPolicy'] as Record<string, unknown>)?.['maximumEventAgeInSeconds'] ?? 3600,
              },
            }
          : {}),
        tags: createStandardTags(node.id, 'aws-eventbridge-scheduler'),
      },
      sourceId: node.id,
      dependsOn: [groupName],
    });

    return resources;
  }
}
