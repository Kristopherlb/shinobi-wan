import type { Node } from '@shinobi/ir';
import type {
  LoweredResource,
  LoweringContext,
  NodeLowerer,
  ResolvedDeps,
} from '../types';
import { shortName, createStandardTags } from './utils';

/**
 * Lowers a platform node with platform "aws-ecs-service" → ECS Service resource.
 * Configures service to run on Fargate with optional load balancer integration.
 */
export class EcsServiceLowerer implements NodeLowerer {
  readonly platform = 'aws-ecs-service';

  lower(
    node: Node,
    context: LoweringContext,
    _resolvedDeps: ResolvedDeps,
  ): ReadonlyArray<LoweredResource> {
    const serviceName = context.adapterConfig.serviceName;
    const name = shortName(node.id);
    const config = node.metadata.properties;
    const extraTags = config['tags'] as Record<string, string> | undefined;

    const dependsOn: string[] = [];

    // Resolve cluster reference
    const clusterRef = config['cluster'] as string | undefined;
    const clusterResourceName = clusterRef
      ? `${shortName(clusterRef)}-cluster`
      : `${name}-cluster`;

    if (clusterRef) {
      dependsOn.push(clusterResourceName);
    }

    // Resolve task definition reference
    const taskDefinitionRef = config['taskDefinition'] as string | undefined;
    const taskDefResourceName = taskDefinitionRef
      ? `${shortName(taskDefinitionRef)}-task-def`
      : `${name}-task-def`;

    if (taskDefinitionRef) {
      dependsOn.push(taskDefResourceName);
    }

    // Network configuration — resolve refs for subnets and security groups
    const subnets = (config['subnets'] as string[] | undefined) ?? [];
    const securityGroups =
      (config['securityGroups'] as string[] | undefined) ?? [];
    const assignPublicIp = config['assignPublicIp'] === true;

    const networkConfiguration = {
      awsvpcConfiguration: {
        subnets: subnets.map((s) => ({ ref: `${shortName(s)}-subnet` })),
        securityGroups: securityGroups.map((sg) => ({
          ref: `${shortName(sg)}-sg`,
        })),
        assignPublicIp,
      },
    };

    // Load balancer configuration (optional)
    const loadBalancerConfigs = config['loadBalancers'] as
      | Array<{
          targetGroupArn: string;
          containerName: string;
          containerPort: number;
        }>
      | undefined;

    const loadBalancers = loadBalancerConfigs
      ? loadBalancerConfigs.map((lb) => ({
          targetGroupArn: { ref: `${shortName(lb.targetGroupArn)}-tg.arn` },
          containerName: lb.containerName,
          containerPort: lb.containerPort,
        }))
      : undefined;

    // Service properties
    const serviceProps: Record<string, unknown> = {
      name: `${serviceName}-${name}`,
      cluster: { ref: `${clusterResourceName}.arn` },
      taskDefinition: { ref: `${taskDefResourceName}.arn` },
      desiredCount: (config['desiredCount'] as number) ?? 1,
      launchType: 'FARGATE',
      networkConfiguration,
      tags: createStandardTags(node.id, 'aws-ecs-service', extraTags),
    };

    if (loadBalancers) {
      serviceProps.loadBalancers = loadBalancers;
    }

    if (config['healthCheckGracePeriodSeconds'] !== undefined) {
      serviceProps.healthCheckGracePeriodSeconds =
        config['healthCheckGracePeriodSeconds'];
    }

    return [
      {
        name: `${name}-service`,
        resourceType: 'aws:ecs:Service',
        properties: serviceProps,
        sourceId: node.id,
        dependsOn,
      },
    ];
  }
}
