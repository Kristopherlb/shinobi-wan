import type { Node } from '@shinobi/ir';
import type {
  LoweredResource,
  LoweringContext,
  NodeLowerer,
  ResolvedDeps,
} from '../types';
import { shortName, createStandardTags, makeResourceName } from './utils';

/**
 * Lowers a platform node with platform "aws-ecs-task-definition" → ECS Task Definition + CloudWatch Log Group.
 */
export class EcsTaskDefinitionLowerer implements NodeLowerer {
  readonly platform = 'aws-ecs-task-definition';

  lower(
    node: Node,
    context: LoweringContext,
    resolvedDeps: ResolvedDeps,
  ): ReadonlyArray<LoweredResource> {
    const serviceName = context.adapterConfig.serviceName;
    const name = shortName(node.id);
    const config = node.metadata.properties;
    const extraTags = config['tags'] as Record<string, string> | undefined;
    const tags = createStandardTags(
      node.id,
      'aws-ecs-task-definition',
      extraTags,
    );

    const resources: LoweredResource[] = [];

    // CloudWatch Log Group for container logs
    resources.push({
      name: `${name}-log-group`,
      resourceType: 'aws:cloudwatch:LogGroup',
      properties: {
        name: `/ecs/${makeResourceName(node.id, serviceName)}`,
        retentionInDays: (config['logRetentionDays'] as number) ?? 7,
        tags,
      },
      sourceId: node.id,
      dependsOn: [],
    });

    // Container definitions — pass through from config
    const containerDefinitions = config['containerDefinitions'] as Array<
      Record<string, unknown>
    >;

    // Task definition properties
    const taskDefProps: Record<string, unknown> = {
      family: `${serviceName}-${name}`,
      cpu: String((config['cpu'] as string | number) ?? 256),
      memory: String((config['memory'] as string | number) ?? 512),
      networkMode: 'awsvpc',
      requiresCompatibilities: ['FARGATE'],
      containerDefinitions: JSON.stringify(containerDefinitions),
      tags,
    };

    // Role ARNs resolved from IAM intents
    if (resolvedDeps.roleName) {
      taskDefProps['executionRoleArn'] = { ref: resolvedDeps.roleName };
      taskDefProps['taskRoleArn'] = { ref: resolvedDeps.roleName };
    }

    resources.push({
      name: `${name}-task-def`,
      resourceType: 'aws:ecs:TaskDefinition',
      properties: taskDefProps,
      sourceId: node.id,
      dependsOn: [`${name}-log-group`],
    });

    return resources;
  }
}
