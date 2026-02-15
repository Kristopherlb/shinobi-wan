import { describe, it, expect } from 'vitest';
import { IamIntentLowerer } from '../lowerers/iam-lowerer';
import { makeIamIntent, makeContext } from './test-helpers';

const lowerer = new IamIntentLowerer();

describe('IamIntentLowerer', () => {
  it('produces Role, Policy, RolePolicyAttachment, and BasicExecution resources', () => {
    const intent = makeIamIntent();
    const resources = lowerer.lower(intent, makeContext());

    expect(resources).toHaveLength(4);

    const types = resources.map((r) => r.resourceType);
    expect(types).toContain('aws:iam:Role');
    expect(types).toContain('aws:iam:Policy');
    expect(types.filter((t) => t === 'aws:iam:RolePolicyAttachment')).toHaveLength(2);
  });

  it('role name derives from principal node ID', () => {
    const intent = makeIamIntent();
    const resources = lowerer.lower(intent, makeContext());

    const role = resources.find((r) => r.resourceType === 'aws:iam:Role');
    expect(role?.name).toBe('api-handler-exec-role');
  });

  it('policy name includes both principal and resource', () => {
    const intent = makeIamIntent();
    const resources = lowerer.lower(intent, makeContext());

    const policy = resources.find((r) => r.resourceType === 'aws:iam:Policy');
    expect(policy?.name).toBe('api-handler-work-queue-policy');
  });

  it('role has Lambda assume role policy', () => {
    const intent = makeIamIntent();
    const resources = lowerer.lower(intent, makeContext());

    const role = resources.find((r) => r.resourceType === 'aws:iam:Role');
    const policy = JSON.parse(role?.properties['assumeRolePolicy'] as string);
    expect(policy.Statement[0].Principal.Service).toBe('lambda.amazonaws.com');
    expect(policy.Statement[0].Action).toBe('sts:AssumeRole');
  });

  it('resolves SQS write actions correctly', () => {
    const intent = makeIamIntent({
      actions: [
        { level: 'write', action: 'read' },
        { level: 'write', action: 'write' },
      ],
    });
    const resources = lowerer.lower(intent, makeContext());

    const policy = resources.find((r) => r.resourceType === 'aws:iam:Policy');
    const policyDoc = JSON.parse(policy?.properties['policy'] as string);
    const actions = policyDoc.Statement[0].Action;

    expect(actions).toContain('sqs:ReceiveMessage');
    expect(actions).toContain('sqs:SendMessage');
    expect(actions).toContain('sqs:GetQueueAttributes');
  });

  it('deduplicates actions', () => {
    const intent = makeIamIntent({
      actions: [
        { level: 'read', action: 'read' },
        { level: 'write', action: 'read' },
      ],
    });
    const resources = lowerer.lower(intent, makeContext());

    const policy = resources.find((r) => r.resourceType === 'aws:iam:Policy');
    const policyDoc = JSON.parse(policy?.properties['policy'] as string);
    const actions = policyDoc.Statement[0].Action as string[];

    // GetQueueAttributes appears in both read and write maps but should only appear once
    const duplicates = actions.filter((a, i) => actions.indexOf(a) !== i);
    expect(duplicates).toHaveLength(0);
  });

  it('attachment depends on both role and policy', () => {
    const intent = makeIamIntent();
    const resources = lowerer.lower(intent, makeContext());

    const attachment = resources.find(
      (r) => r.resourceType === 'aws:iam:RolePolicyAttachment' && r.name.endsWith('-policy-attachment')
    );
    expect(attachment?.dependsOn).toContain('api-handler-exec-role');
    expect(attachment?.dependsOn).toContain('api-handler-work-queue-policy');
  });

  it('all resources carry sourceId from intent', () => {
    const intent = makeIamIntent();
    const resources = lowerer.lower(intent, makeContext());

    for (const r of resources) {
      expect(r.sourceId).toBe(intent.sourceEdgeId);
    }
  });

  it('scope:specific uses resource pattern in IAM policy Resource field', () => {
    const intent = makeIamIntent({
      resource: {
        nodeRef: 'platform:work-queue',
        resourceType: 'queue',
        scope: 'specific',
        pattern: 'arn:*:sqs:*:*:work-queue',
      },
    });
    const resources = lowerer.lower(intent, makeContext());

    const policy = resources.find((r) => r.resourceType === 'aws:iam:Policy');
    const policyDoc = JSON.parse(policy?.properties['policy'] as string);
    expect(policyDoc.Statement[0].Resource).toBe('arn:*:sqs:*:*:work-queue');
  });

  it('scope:pattern uses wildcard * in IAM policy Resource field', () => {
    const intent = makeIamIntent({
      resource: {
        nodeRef: 'platform:work-queue',
        resourceType: 'queue',
        scope: 'pattern',
      },
    });
    const resources = lowerer.lower(intent, makeContext());

    const policy = resources.find((r) => r.resourceType === 'aws:iam:Policy');
    const policyDoc = JSON.parse(policy?.properties['policy'] as string);
    expect(policyDoc.Statement[0].Resource).toBe('*');
  });

  it('determinism: identical input produces identical output', () => {
    const intent = makeIamIntent();
    const ctx = makeContext();
    const r1 = lowerer.lower(intent, ctx);
    const r2 = lowerer.lower(intent, ctx);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});
