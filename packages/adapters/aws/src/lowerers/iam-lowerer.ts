import type { IamIntent } from '@shinobi/contracts';
import type { LoweredResource, LoweringContext, IntentLowerer } from '../types';

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
};

const DEFAULT_ACTIONS: Record<string, ReadonlyArray<string>> = {
  read: ['*:Get*', '*:List*'],
  write: ['*:Get*', '*:List*', '*:Put*', '*:Update*'],
  admin: ['*:*'],
};

/**
 * Extracts a short name from a kernel node ID.
 * e.g., "component:api-handler" → "api-handler"
 */
function shortName(nodeRef: string): string {
  const idx = nodeRef.indexOf(':');
  return idx >= 0 ? nodeRef.substring(idx + 1) : nodeRef;
}

/**
 * Lowers IamIntent → IAM Role + Policy + RolePolicyAttachment resources.
 */
export class IamIntentLowerer implements IntentLowerer<IamIntent> {
  readonly intentType = 'iam' as const;

  lower(intent: IamIntent, _context: LoweringContext): ReadonlyArray<LoweredResource> {
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
              Resource: intent.resource.scope === 'specific' ? (intent.resource.pattern ?? '*') : '*',
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
