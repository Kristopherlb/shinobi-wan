import type { Node } from '@shinobi/ir';
import type { LoweredResource, LoweringContext, NodeLowerer, ResolvedDeps } from '../types';
import { shortName, createStandardTags } from './utils';

/**
 * Lowers a platform node with platform "aws-stepfunctions" →
 * Step Functions StateMachine + CloudWatch LogGroup resources.
 */
export class StepFunctionsLowerer implements NodeLowerer {
  readonly platform = 'aws-stepfunctions';

  lower(node: Node, context: LoweringContext, resolvedDeps: ResolvedDeps): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const props = node.metadata.properties;

    const resources: LoweredResource[] = [];

    // CloudWatch Log Group for state machine logging
    const logGroupName = `${name}-log-group`;
    resources.push({
      name: logGroupName,
      resourceType: 'aws:cloudwatch:LogGroup',
      properties: {
        name: `/aws/vendedlogs/states/${context.adapterConfig.serviceName}-${name}`,
        retentionInDays: (props['logRetentionDays'] as number) ?? 30,
        tags: createStandardTags(node.id, 'aws-stepfunctions'),
      },
      sourceId: node.id,
      dependsOn: [],
    });

    // State Machine
    const machineType = (props['type'] as string) ?? 'STANDARD';
    const definition = (props['definition'] as string) ?? JSON.stringify({
      Comment: `State machine for ${name}`,
      StartAt: 'PassState',
      States: {
        PassState: { Type: 'Pass', End: true },
      },
    });

    const loggingEnabled = props['logging'] !== false;

    resources.push({
      name: `${name}-state-machine`,
      resourceType: 'aws:sfn:StateMachine',
      properties: {
        name: `${context.adapterConfig.serviceName}-${name}`,
        type: machineType,
        definition,
        ...(resolvedDeps.roleName ? { roleArn: { ref: `${resolvedDeps.roleName}` } } : {}),
        ...(loggingEnabled
          ? {
              loggingConfiguration: {
                level: (props['logLevel'] as string) ?? 'ALL',
                includeExecutionData: true,
                logDestination: { ref: `${logGroupName}` },
              },
            }
          : {}),
        tags: createStandardTags(node.id, 'aws-stepfunctions'),
      },
      sourceId: node.id,
      dependsOn: loggingEnabled ? [logGroupName] : [],
    });

    return resources;
  }
}
