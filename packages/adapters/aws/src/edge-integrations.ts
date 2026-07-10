import type { Edge } from '@shinobi/ir';
import type { LoweredResource, LoweringContext } from './types';
import { shortName } from './lowerers/utils';

interface EdgeIntegrationTemplate {
  readonly edgeType: 'bindsTo' | 'triggers';
  readonly sourcePlatform: string;
  readonly targetPlatform: string;
  readonly generate: (
    edge: Edge,
    sourceName: string,
    targetName: string,
    context: LoweringContext,
  ) => LoweredResource[];
}

const EDGE_INTEGRATION_TEMPLATES: ReadonlyArray<EdgeIntegrationTemplate> = [
  {
    edgeType: 'bindsTo',
    sourcePlatform: 'aws-lambda',
    targetPlatform: 'aws-sqs',
    generate: generateEventSourceMapping,
  },
  {
    edgeType: 'triggers',
    sourcePlatform: 'aws-apigateway',
    targetPlatform: 'aws-lambda',
    generate: generateApiGatewayLambdaIntegration,
  },
  {
    edgeType: 'triggers',
    sourcePlatform: 'aws-eventbridge-scheduler',
    targetPlatform: 'aws-lambda',
    generate: generateEventBridgeLambdaTarget,
  },
  {
    edgeType: 'triggers',
    sourcePlatform: 'aws-eventbridge-scheduler',
    targetPlatform: 'aws-stepfunctions',
    generate: generateEventBridgeStepFunctionsTarget,
  },
];

/**
 * Generates all edge integration resources by walking snapshot edges
 * and dispatching to the appropriate resource generator.
 */
export function generateEdgeIntegrations(
  context: LoweringContext,
): LoweredResource[] {
  const resources: LoweredResource[] = [];

  for (const edge of context.snapshot.edges) {
    const sourceNode = context.snapshot.nodes.find((n) => n.id === edge.source);
    const targetNode = context.snapshot.nodes.find((n) => n.id === edge.target);
    if (!sourceNode || !targetNode) continue;

    const sourcePlatform = sourceNode.metadata.properties['platform'] as
      | string
      | undefined;
    const targetPlatform = targetNode.metadata.properties['platform'] as
      | string
      | undefined;
    if (!sourcePlatform || !targetPlatform) continue;

    for (const template of EDGE_INTEGRATION_TEMPLATES) {
      if (
        edge.type === template.edgeType &&
        sourcePlatform === template.sourcePlatform &&
        targetPlatform === template.targetPlatform
      ) {
        const sourceName = shortName(sourceNode.id);
        const targetName = shortName(targetNode.id);
        resources.push(
          ...template.generate(edge, sourceName, targetName, context),
        );
      }
    }
  }

  return resources;
}

function generateEventSourceMapping(
  edge: Edge,
  lambdaName: string,
  sqsName: string,
): LoweredResource[] {
  return [
    {
      name: `${lambdaName}-${sqsName}-event-mapping`,
      resourceType: 'aws:lambda:EventSourceMapping',
      properties: {
        functionName: { ref: `${lambdaName}-function` },
        eventSourceArn: { ref: `${sqsName}-queue` },
        batchSize: 10,
        enabled: true,
        tags: {
          'shinobi:edge': edge.id,
        },
      },
      sourceId: edge.id,
      dependsOn: [`${lambdaName}-function`, `${sqsName}-queue`],
    },
  ];
}

function generateApiGatewayLambdaIntegration(
  edge: Edge,
  apiName: string,
  lambdaName: string,
): LoweredResource[] {
  const bindingConfig = edge.metadata.bindingConfig as
    | { route?: string; method?: string }
    | undefined;
  const route = bindingConfig?.route;
  const method = bindingConfig?.method;

  const routeKey = route && method ? `${method} ${route}` : '$default';

  const integrationName = `${apiName}-${lambdaName}-integration`;
  const routeName = `${apiName}-${lambdaName}-route`;
  const permissionName = `${apiName}-${lambdaName}-permission`;

  return [
    {
      name: integrationName,
      resourceType: 'aws:apigatewayv2:Integration',
      properties: {
        apiId: { ref: `${apiName}-api` },
        integrationType: 'AWS_PROXY',
        integrationUri: { ref: `${lambdaName}-function` },
        payloadFormatVersion: '2.0',
        tags: {
          'shinobi:edge': edge.id,
        },
      },
      sourceId: edge.id,
      dependsOn: [`${apiName}-api`, `${lambdaName}-function`],
    },
    {
      name: routeName,
      resourceType: 'aws:apigatewayv2:Route',
      properties: {
        apiId: { ref: `${apiName}-api` },
        routeKey,
        target: { ref: integrationName },
      },
      sourceId: edge.id,
      dependsOn: [`${apiName}-api`, integrationName],
    },
    {
      name: permissionName,
      resourceType: 'aws:lambda:Permission',
      properties: {
        action: 'lambda:InvokeFunction',
        function: { ref: `${lambdaName}-function` },
        principal: 'apigateway.amazonaws.com',
        sourceArn: { ref: `${apiName}-api` },
        tags: {
          'shinobi:edge': edge.id,
        },
      },
      sourceId: edge.id,
      dependsOn: [`${lambdaName}-function`, `${apiName}-api`],
    },
  ];
}

function generateEventBridgeLambdaTarget(
  edge: Edge,
  schedulerName: string,
  targetName: string,
): LoweredResource[] {
  return [
    {
      name: `${schedulerName}-${targetName}-target`,
      resourceType: 'aws:scheduler:ScheduleTarget',
      properties: {
        scheduleArn: { ref: `${schedulerName}-schedule` },
        arn: { ref: `${targetName}-function` },
        roleArn: { ref: `${schedulerName}-exec-role` },
        tags: {
          'shinobi:edge': edge.id,
        },
      },
      sourceId: edge.id,
      dependsOn: [`${schedulerName}-schedule`, `${targetName}-function`],
    },
  ];
}

function generateEventBridgeStepFunctionsTarget(
  edge: Edge,
  schedulerName: string,
  targetName: string,
): LoweredResource[] {
  return [
    {
      name: `${schedulerName}-${targetName}-target`,
      resourceType: 'aws:scheduler:ScheduleTarget',
      properties: {
        scheduleArn: { ref: `${schedulerName}-schedule` },
        arn: { ref: `${targetName}-state-machine` },
        roleArn: { ref: `${schedulerName}-exec-role` },
        tags: {
          'shinobi:edge': edge.id,
        },
      },
      sourceId: edge.id,
      dependsOn: [`${schedulerName}-schedule`, `${targetName}-state-machine`],
    },
  ];
}
