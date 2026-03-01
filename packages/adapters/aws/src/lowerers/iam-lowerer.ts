import type { IamIntent } from '@shinobi/contracts';
import type { Node } from '@shinobi/ir';
import type { LoweredResource, LoweringContext, IntentLowerer } from '../types';
import { shortName } from './utils';

/** Maps intent action levels to AWS IAM action prefixes per resource type */
const ACTION_MAP: Record<string, Record<string, ReadonlyArray<string>>> = {
  queue: {
    read: ['sqs:ReceiveMessage', 'sqs:GetQueueAttributes', 'sqs:GetQueueUrl'],
    write: ['sqs:SendMessage', 'sqs:GetQueueAttributes', 'sqs:GetQueueUrl'],
    admin: ['sqs:*'],
  },
  bucket: {
    read: ['s3:GetObject', 's3:ListBucket'],
    write: ['s3:PutObject', 's3:GetObject', 's3:ListBucket'],
    admin: ['s3:*'],
  },
  table: {
    read: ['dynamodb:GetItem', 'dynamodb:Query', 'dynamodb:Scan'],
    write: ['dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:DeleteItem', 'dynamodb:GetItem', 'dynamodb:Query'],
    admin: ['dynamodb:*'],
  },
  api: {
    invoke: ['lambda:InvokeFunction'],
    read: ['execute-api:Invoke'],
    write: ['execute-api:Invoke'],
    admin: ['execute-api:*'],
  },
  topic: {
    read: ['sns:GetTopicAttributes', 'sns:ListSubscriptionsByTopic'],
    write: ['sns:Publish', 'sns:GetTopicAttributes'],
    admin: ['sns:*'],
  },
  xray: {
    read: ['xray:GetSamplingRules', 'xray:GetSamplingTargets', 'xray:GetTraceGraph'],
    write: ['xray:PutTraceSegments', 'xray:PutTelemetryRecords', 'xray:GetSamplingRules', 'xray:GetSamplingTargets'],
    admin: ['xray:*'],
  },
  distribution: {
    read: ['cloudfront:GetDistribution', 'cloudfront:ListDistributions'],
    write: ['cloudfront:CreateInvalidation', 'cloudfront:GetDistribution', 'cloudfront:ListDistributions'],
    admin: ['cloudfront:*'],
  },
  webacl: {
    read: ['wafv2:GetWebACL', 'wafv2:ListWebACLs'],
    write: ['wafv2:UpdateWebACL', 'wafv2:GetWebACL'],
    admin: ['wafv2:*'],
  },
  certificate: {
    read: ['acm:DescribeCertificate', 'acm:ListCertificates'],
    write: ['acm:RequestCertificate', 'acm:DescribeCertificate'],
    admin: ['acm:*'],
  },
  scheduler: {
    read: ['scheduler:GetSchedule', 'scheduler:ListSchedules'],
    write: ['scheduler:CreateSchedule', 'scheduler:UpdateSchedule', 'scheduler:GetSchedule'],
    admin: ['scheduler:*'],
  },
  statemachine: {
    read: ['states:DescribeStateMachine', 'states:ListStateMachines', 'states:ListExecutions'],
    write: ['states:StartExecution', 'states:StopExecution', 'states:DescribeStateMachine'],
    admin: ['states:*'],
  },
  cluster: {
    read: ['ecs:DescribeClusters', 'ecs:ListClusters'],
    write: ['ecs:RunTask', 'ecs:StopTask', 'ecs:DescribeTasks', 'ecs:ListTasks'],
    admin: ['ecs:*'],
  },
  'task-definition': {
    read: ['ecs:DescribeTaskDefinition', 'ecs:ListTaskDefinitions'],
    write: ['ecs:RegisterTaskDefinition', 'ecs:DeregisterTaskDefinition'],
    admin: ['ecs:*'],
  },
  repository: {
    read: ['ecr:GetAuthorizationToken', 'ecr:BatchCheckLayerAvailability', 'ecr:GetDownloadUrlForLayer', 'ecr:BatchGetImage'],
    write: ['ecr:PutImage', 'ecr:InitiateLayerUpload', 'ecr:UploadLayerPart', 'ecr:CompleteLayerUpload'],
    admin: ['ecr:*'],
  },
  'load-balancer': {
    read: ['elasticloadbalancing:DescribeLoadBalancers', 'elasticloadbalancing:DescribeTargetGroups', 'elasticloadbalancing:DescribeListeners'],
    write: ['elasticloadbalancing:RegisterTargets', 'elasticloadbalancing:DeregisterTargets'],
    admin: ['elasticloadbalancing:*'],
  },
};

const DEFAULT_ACTIONS: Record<string, ReadonlyArray<string>> = {
  read: ['*:Get*', '*:List*'],
  write: ['*:Get*', '*:List*', '*:Put*', '*:Update*'],
  admin: ['*:*'],
};

/**
 * Lowers IamIntent → IAM Role + Policy + RolePolicyAttachment resources.
 */
export class IamIntentLowerer implements IntentLowerer<IamIntent> {
  readonly intentType = 'iam' as const;

  lower(intent: IamIntent, context: LoweringContext): ReadonlyArray<LoweredResource> {
    const principalName = shortName(intent.principal.nodeRef);
    const roleName = `${principalName}-exec-role`;
    const policyName = `${principalName}-${shortName(intent.resource.nodeRef)}-policy`;
    const attachmentName = `${policyName}-attachment`;

    // Collect IAM actions
    const iamActions = this.resolveActions(intent);

    const resources: LoweredResource[] = [];

    // 1. IAM Role (Lambda assume role)
    resources.push({
      name: roleName,
      resourceType: 'aws:iam:Role',
      properties: {
        assumeRolePolicy: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { Service: 'lambda.amazonaws.com' },
              Action: 'sts:AssumeRole',
            },
          ],
        }),
        tags: { 'shinobi:principal': intent.principal.nodeRef },
      },
      sourceId: intent.sourceEdgeId,
      dependsOn: [],
    });

    // 2. IAM Policy
    resources.push({
      name: policyName,
      resourceType: 'aws:iam:Policy',
      properties: {
        policy: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Action: iamActions,
              Resource: this.resolvePolicyResource(intent, context),
              ...(intent.conditions && intent.conditions.length > 0
                ? { Condition: this.buildConditions(intent) }
                : {}),
            },
          ],
        }),
        tags: {
          'shinobi:resource': intent.resource.nodeRef,
          'shinobi:edge': intent.sourceEdgeId,
        },
      },
      sourceId: intent.sourceEdgeId,
      dependsOn: [],
    });

    // 3. Role-Policy Attachment
    resources.push({
      name: attachmentName,
      resourceType: 'aws:iam:RolePolicyAttachment',
      properties: {
        role: { ref: roleName },
        policyArn: { ref: policyName },
      },
      sourceId: intent.sourceEdgeId,
      dependsOn: [roleName, policyName],
    });

    // 4. Basic execution role attachment (for CloudWatch logs)
    const basicAttachmentName = `${principalName}-basic-execution-attachment`;
    resources.push({
      name: basicAttachmentName,
      resourceType: 'aws:iam:RolePolicyAttachment',
      properties: {
        role: { ref: roleName },
        policyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
      },
      sourceId: intent.sourceEdgeId,
      dependsOn: [roleName],
    });

    return resources;
  }

  private resolvePolicyResource(intent: IamIntent, context: LoweringContext): string {
    if (intent.resource.scope === 'pattern') {
      if (!intent.resource.pattern) {
        throw new Error(
          `IAM intent "${intent.sourceEdgeId}" uses scope=pattern but does not provide resource.pattern`,
        );
      }
      return intent.resource.pattern;
    }

    if (intent.resource.pattern) {
      return intent.resource.pattern;
    }

    const target = context.snapshot.nodes.find((n) => n.id === intent.resource.nodeRef);
    if (!target) {
      throw new Error(
        `IAM intent "${intent.sourceEdgeId}" references unknown resource node "${intent.resource.nodeRef}"`,
      );
    }

    const resolved = this.resolveArnPatternFromNode(target, context);
    if (!resolved) {
      throw new Error(
        `IAM intent "${intent.sourceEdgeId}" cannot resolve specific resource pattern for platform "${String(
          target.metadata.properties['platform'],
        )}"`,
      );
    }
    return resolved;
  }

  private resolveArnPatternFromNode(node: Node, context: LoweringContext): string | undefined {
    const platform = node.metadata.properties['platform'] as string | undefined;
    const name = `${context.adapterConfig.serviceName}-${shortName(node.id)}`;

    switch (platform) {
      case 'aws-sqs':
        return `arn:aws:sqs:*:*:${name}`;
      case 'aws-lambda':
        return `arn:aws:lambda:*:*:function:${name}`;
      case 'aws-dynamodb':
        return `arn:aws:dynamodb:*:*:table/${name}`;
      case 'aws-s3':
        return `arn:aws:s3:::${name}`;
      case 'aws-apigateway':
        return `arn:aws:execute-api:*:*:*`;
      case 'aws-sns':
        return `arn:aws:sns:*:*:${name}`;
      case 'aws-cloudfront':
        return `arn:aws:cloudfront::*:distribution/*`;
      case 'aws-wafv2':
        return `arn:aws:wafv2:*:*:*/webacl/${name}/*`;
      case 'aws-acm':
        return `arn:aws:acm:*:*:certificate/*`;
      case 'aws-eventbridge-scheduler':
        return `arn:aws:scheduler:*:*:schedule/${name}/*`;
      case 'aws-stepfunctions':
        return `arn:aws:states:*:*:stateMachine:${name}`;
      case 'aws-ecr':
        return `arn:aws:ecr:*:*:repository/${name}`;
      case 'aws-ecs-cluster':
        return `arn:aws:ecs:*:*:cluster/${name}`;
      case 'aws-ecs-task-definition':
        return `arn:aws:ecs:*:*:task-definition/${name}:*`;
      case 'aws-ecs-service':
        return `arn:aws:ecs:*:*:service/${name}/*`;
      case 'aws-alb':
        return `arn:aws:elasticloadbalancing:*:*:loadbalancer/app/${name}/*`;
      case 'aws-vpc':
        return `arn:aws:ec2:*:*:vpc/*`;
      case 'aws-subnet':
        return `arn:aws:ec2:*:*:subnet/*`;
      case 'aws-security-group':
        return `arn:aws:ec2:*:*:security-group/*`;
      default:
        return undefined;
    }
  }

  private resolveActions(intent: IamIntent): ReadonlyArray<string> {
    const resourceType = intent.resource.resourceType;
    const actions: string[] = [];

    for (const action of intent.actions) {
      const typeMap = ACTION_MAP[resourceType];
      if (typeMap && typeMap[action.action]) {
        actions.push(...typeMap[action.action]);
      } else {
        const defaults = DEFAULT_ACTIONS[action.action];
        if (defaults) {
          actions.push(...defaults);
        }
      }
    }

    // Deduplicate while preserving order
    return [...new Set(actions)];
  }

  private buildConditions(intent: IamIntent): Record<string, Record<string, string>> {
    const conditions: Record<string, Record<string, string>> = {};
    for (const cond of intent.conditions ?? []) {
      const op = this.mapOperator(cond.operator);
      if (!conditions[op]) conditions[op] = {};
      conditions[op][cond.key] = cond.value;
    }
    return conditions;
  }

  private mapOperator(op: string): string {
    switch (op) {
      case 'equals': return 'StringEquals';
      case 'notEquals': return 'StringNotEquals';
      case 'contains': return 'StringLike';
      case 'startsWith': return 'StringLike';
      default: return 'StringEquals';
    }
  }
}
