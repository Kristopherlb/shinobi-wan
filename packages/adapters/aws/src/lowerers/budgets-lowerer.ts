import type { Node } from '@shinobi/ir';
import type {
  LoweredResource,
  LoweringContext,
  NodeLowerer,
  ResolvedDeps,
} from '../types';
import { shortName, createStandardTags } from './utils';

/**
 * Lowers a platform node with platform "aws-budgets" →
 * AWS Budgets Budget resource.
 */
export class BudgetsLowerer implements NodeLowerer {
  readonly platform = 'aws-budgets';

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

    const budgetName = `${name}-budget`;

    const budgetType = (props['budgetType'] as string) ?? 'COST';
    const limitAmount = (props['limitAmount'] as string) ?? '100';
    const limitUnit = (props['limitUnit'] as string) ?? 'USD';
    const timeUnit = (props['timeUnit'] as string) ?? 'MONTHLY';

    const budgetProperties: Record<string, unknown> = {
      name: `${serviceName}-${name}`,
      budgetType,
      limitAmount,
      limitUnit,
      timeUnit,
      tags: createStandardTags(node.id, 'aws-budgets', extraTags),
    };

    // Notification configuration
    if (props['thresholdPercentage'] || props['notificationTopicArn']) {
      const notifications: Record<string, unknown>[] = [];
      if (props['thresholdPercentage']) {
        notifications.push({
          comparisonOperator: 'GREATER_THAN',
          threshold: props['thresholdPercentage'],
          thresholdType: 'PERCENTAGE',
          notificationType: 'ACTUAL',
        });
      }
      budgetProperties['notifications'] = notifications;

      if (props['notificationTopicArn']) {
        budgetProperties['subscribers'] = [
          {
            subscriptionType: 'SNS',
            address:
              typeof props['notificationTopicArn'] === 'string' &&
              props['notificationTopicArn'].startsWith('platform:')
                ? {
                    ref: `${shortName(props['notificationTopicArn'] as string)}-topic`,
                  }
                : props['notificationTopicArn'],
          },
        ];
      }
    }

    resources.push({
      name: budgetName,
      resourceType: 'aws:budgets:Budget',
      properties: budgetProperties,
      sourceId: node.id,
      dependsOn: [],
    });

    return resources;
  }
}
