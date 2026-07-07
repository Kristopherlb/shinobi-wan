import { describe, it, expect } from 'vitest';
import { EventBridgeLowerer } from '../lowerers/eventbridge-lowerer';
import { StepFunctionsLowerer } from '../lowerers/stepfunctions-lowerer';
import { makeNode, makeDefaultContext, makeDefaultDeps } from './test-helpers';

const DEFAULT_CONTEXT = makeDefaultContext({
  adapterConfig: { region: 'us-east-1', serviceName: 'my-service' },
});
const DEFAULT_DEPS = makeDefaultDeps();

// ---------------------------------------------------------------------------
// EventBridgeLowerer
// ---------------------------------------------------------------------------
describe('EventBridgeLowerer', () => {
  const lowerer = new EventBridgeLowerer();

  const makeSchedulerNode = (props?: Record<string, unknown>) =>
    makeNode({
      id: 'platform:scheduled-task',
      type: 'platform',
      metadata: {
        properties: { platform: 'aws-eventbridge-scheduler', ...props },
      },
    });

  it('has correct platform', () => {
    expect(lowerer.platform).toBe('aws-eventbridge-scheduler');
  });

  it('produces ScheduleGroup + Schedule (2 resources)', () => {
    const node = makeSchedulerNode();
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources).toHaveLength(2);
  });

  it('ScheduleGroup has correct resource type', () => {
    const node = makeSchedulerNode();
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0]?.resourceType).toBe('aws:scheduler:ScheduleGroup');
  });

  it('ScheduleGroup has correct naming: {name}-schedule-group', () => {
    const node = makeSchedulerNode();
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0]?.name).toBe('scheduled-task-schedule-group');
  });

  it('ScheduleGroup properties include serviceName prefix', () => {
    const node = makeSchedulerNode();
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const props = resources[0]?.properties;
    expect(props?.['name']).toBe('my-service-scheduled-task');
  });

  it('ScheduleGroup has correct tags', () => {
    const node = makeSchedulerNode();
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = resources[0]?.properties['tags'] as Record<string, string>;
    expect(tags?.['shinobi:node']).toBe('platform:scheduled-task');
    expect(tags?.['shinobi:platform']).toBe('aws-eventbridge-scheduler');
  });

  it('ScheduleGroup has no dependencies', () => {
    const node = makeSchedulerNode();
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0]?.dependsOn).toEqual([]);
  });

  it('Schedule has correct resource type', () => {
    const node = makeSchedulerNode();
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[1]?.resourceType).toBe('aws:scheduler:Schedule');
  });

  it('Schedule has correct naming: {name}-schedule', () => {
    const node = makeSchedulerNode();
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[1]?.name).toBe('scheduled-task-schedule');
  });

  it('Schedule depends on ScheduleGroup', () => {
    const node = makeSchedulerNode();
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[1]?.dependsOn).toEqual(['scheduled-task-schedule-group']);
  });

  it('Schedule has default expression: rate(1 hour)', () => {
    const node = makeSchedulerNode();
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const props = resources[1]?.properties;
    expect(props?.['scheduleExpression']).toBe('rate(1 hour)');
  });

  it('Schedule uses custom expression from config', () => {
    const node = makeSchedulerNode({
      scheduleExpression: 'cron(0 12 * * ? *)',
    });
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const props = resources[1]?.properties;
    expect(props?.['scheduleExpression']).toBe('cron(0 12 * * ? *)');
  });

  it('Schedule has correct tags', () => {
    const node = makeSchedulerNode();
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = resources[1]?.properties['tags'] as Record<string, string>;
    expect(tags?.['shinobi:node']).toBe('platform:scheduled-task');
    expect(tags?.['shinobi:platform']).toBe('aws-eventbridge-scheduler');
  });

  it('Schedule state defaults to ENABLED', () => {
    const node = makeSchedulerNode();
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const props = resources[1]?.properties;
    expect(props?.['state']).toBe('ENABLED');
  });

  it('Schedule state is DISABLED when enabled: false', () => {
    const node = makeSchedulerNode({ enabled: false });
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const props = resources[1]?.properties;
    expect(props?.['state']).toBe('DISABLED');
  });

  it('Schedule state is ENABLED when enabled: true', () => {
    const node = makeSchedulerNode({ enabled: true });
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const props = resources[1]?.properties;
    expect(props?.['state']).toBe('ENABLED');
  });

  it('Schedule includes retryPolicy when configured', () => {
    const node = makeSchedulerNode({
      retryPolicy: {
        maximumRetryAttempts: 5,
        maximumEventAgeInSeconds: 7200,
      },
    });
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const props = resources[1]?.properties;
    const retryPolicy = props?.['retryPolicy'] as Record<string, unknown>;
    expect(retryPolicy?.['maximumRetryAttempts']).toBe(5);
    expect(retryPolicy?.['maximumEventAgeInSeconds']).toBe(7200);
  });

  it('Schedule retryPolicy uses defaults when partial config provided', () => {
    const node = makeSchedulerNode({ retryPolicy: {} });
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const props = resources[1]?.properties;
    const retryPolicy = props?.['retryPolicy'] as Record<string, unknown>;
    expect(retryPolicy?.['maximumRetryAttempts']).toBe(2);
    expect(retryPolicy?.['maximumEventAgeInSeconds']).toBe(3600);
  });

  it('Schedule has no retryPolicy when not configured', () => {
    const node = makeSchedulerNode();
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const props = resources[1]?.properties;
    expect(props?.['retryPolicy']).toBeUndefined();
  });

  it('Schedule flexibleTimeWindow defaults to OFF', () => {
    const node = makeSchedulerNode();
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const props = resources[1]?.properties;
    const ftw = props?.['flexibleTimeWindow'] as Record<string, unknown>;
    expect(ftw?.['mode']).toBe('OFF');
  });

  it('Schedule uses custom flexibleTimeWindow from config', () => {
    const node = makeSchedulerNode({ flexibleTimeWindow: 'FLEXIBLE' });
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const props = resources[1]?.properties;
    const ftw = props?.['flexibleTimeWindow'] as Record<string, unknown>;
    expect(ftw?.['mode']).toBe('FLEXIBLE');
  });

  it('Schedule groupName references ScheduleGroup', () => {
    const node = makeSchedulerNode();
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const props = resources[1]?.properties;
    const groupName = props?.['groupName'] as Record<string, unknown>;
    expect(groupName?.['ref']).toBe('scheduled-task-schedule-group');
  });

  it('sets sourceId to node ID for both resources', () => {
    const node = makeSchedulerNode();
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0]?.sourceId).toBe('platform:scheduled-task');
    expect(resources[1]?.sourceId).toBe('platform:scheduled-task');
  });

  it('output is deterministic', () => {
    const node = makeSchedulerNode();
    const r1 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const r2 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});

// ---------------------------------------------------------------------------
// StepFunctionsLowerer
// ---------------------------------------------------------------------------
describe('StepFunctionsLowerer', () => {
  const lowerer = new StepFunctionsLowerer();

  const makeSfnNode = (props?: Record<string, unknown>) =>
    makeNode({
      id: 'platform:my-workflow',
      type: 'platform',
      metadata: { properties: { platform: 'aws-stepfunctions', ...props } },
    });

  it('has correct platform', () => {
    expect(lowerer.platform).toBe('aws-stepfunctions');
  });

  it('produces LogGroup + StateMachine (2 resources)', () => {
    const node = makeSfnNode();
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources).toHaveLength(2);
  });

  it('LogGroup has correct resource type', () => {
    const node = makeSfnNode();
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0]?.resourceType).toBe('aws:cloudwatch:LogGroup');
  });

  it('LogGroup has correct naming: {name}-log-group', () => {
    const node = makeSfnNode();
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0]?.name).toBe('my-workflow-log-group');
  });

  it('LogGroup uses vendedlogs path with serviceName prefix', () => {
    const node = makeSfnNode();
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const props = resources[0]?.properties;
    expect(props?.['name']).toBe(
      '/aws/vendedlogs/states/my-service-my-workflow',
    );
  });

  it('LogGroup has default retention: 30 days', () => {
    const node = makeSfnNode();
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const props = resources[0]?.properties;
    expect(props?.['retentionInDays']).toBe(30);
  });

  it('LogGroup uses custom retention from config', () => {
    const node = makeSfnNode({ logRetentionDays: 90 });
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const props = resources[0]?.properties;
    expect(props?.['retentionInDays']).toBe(90);
  });

  it('LogGroup has correct tags', () => {
    const node = makeSfnNode();
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = resources[0]?.properties['tags'] as Record<string, string>;
    expect(tags?.['shinobi:node']).toBe('platform:my-workflow');
    expect(tags?.['shinobi:platform']).toBe('aws-stepfunctions');
  });

  it('LogGroup has no dependencies', () => {
    const node = makeSfnNode();
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0]?.dependsOn).toEqual([]);
  });

  it('StateMachine has correct resource type', () => {
    const node = makeSfnNode();
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[1]?.resourceType).toBe('aws:sfn:StateMachine');
  });

  it('StateMachine has correct naming: {name}-state-machine', () => {
    const node = makeSfnNode();
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[1]?.name).toBe('my-workflow-state-machine');
  });

  it('StateMachine depends on LogGroup when logging enabled', () => {
    const node = makeSfnNode();
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[1]?.dependsOn).toEqual(['my-workflow-log-group']);
  });

  it('StateMachine has no dependencies when logging disabled', () => {
    const node = makeSfnNode({ logging: false });
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[1]?.dependsOn).toEqual([]);
  });

  it('StateMachine type defaults to STANDARD', () => {
    const node = makeSfnNode();
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const props = resources[1]?.properties;
    expect(props?.['type']).toBe('STANDARD');
  });

  it('StateMachine uses custom type from config', () => {
    const node = makeSfnNode({ type: 'EXPRESS' });
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const props = resources[1]?.properties;
    expect(props?.['type']).toBe('EXPRESS');
  });

  it('StateMachine has default definition (Pass state)', () => {
    const node = makeSfnNode();
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const props = resources[1]?.properties;
    const definition = JSON.parse(props?.['definition'] as string);
    expect(definition.Comment).toContain('State machine for my-workflow');
    expect(definition.StartAt).toBe('PassState');
    expect(definition.States.PassState).toEqual({ Type: 'Pass', End: true });
  });

  it('StateMachine uses custom definition from config', () => {
    const customDef = JSON.stringify({
      Comment: 'Custom workflow',
      StartAt: 'Task1',
      States: {
        Task1: {
          Type: 'Task',
          Resource: 'arn:aws:lambda:us-east-1:123456789012:function:MyFunction',
          End: true,
        },
      },
    });
    const node = makeSfnNode({ definition: customDef });
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const props = resources[1]?.properties;
    expect(props?.['definition']).toBe(customDef);
  });

  it('StateMachine logging configuration is included by default', () => {
    const node = makeSfnNode();
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const props = resources[1]?.properties;
    const loggingConfig = props?.['loggingConfiguration'] as Record<
      string,
      unknown
    >;
    expect(loggingConfig).toBeDefined();
    expect(loggingConfig?.['level']).toBe('ALL');
    expect(loggingConfig?.['includeExecutionData']).toBe(true);
  });

  it('StateMachine logging configuration can be disabled', () => {
    const node = makeSfnNode({ logging: false });
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const props = resources[1]?.properties;
    expect(props?.['loggingConfiguration']).toBeUndefined();
  });

  it('StateMachine logging level uses custom value from config', () => {
    const node = makeSfnNode({ logLevel: 'ERROR' });
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const props = resources[1]?.properties;
    const loggingConfig = props?.['loggingConfiguration'] as Record<
      string,
      unknown
    >;
    expect(loggingConfig?.['level']).toBe('ERROR');
  });

  it('StateMachine logging references LogGroup', () => {
    const node = makeSfnNode();
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const props = resources[1]?.properties;
    const loggingConfig = props?.['loggingConfiguration'] as Record<
      string,
      unknown
    >;
    const logDestination = loggingConfig?.['logDestination'] as Record<
      string,
      unknown
    >;
    expect(logDestination?.['ref']).toBe('my-workflow-log-group');
  });

  it('StateMachine includes roleArn when resolvedDeps has roleName', () => {
    const node = makeSfnNode();
    const depsWithRole: ResolvedDeps = {
      ...DEFAULT_DEPS,
      roleName: 'my-workflow-role',
    };
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, depsWithRole);
    const props = resources[1]?.properties;
    const roleArn = props?.['roleArn'] as Record<string, unknown>;
    expect(roleArn?.['ref']).toBe('my-workflow-role');
  });

  it('StateMachine has no roleArn when resolvedDeps has no roleName', () => {
    const node = makeSfnNode();
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const props = resources[1]?.properties;
    expect(props?.['roleArn']).toBeUndefined();
  });

  it('StateMachine has correct tags', () => {
    const node = makeSfnNode();
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = resources[1]?.properties['tags'] as Record<string, string>;
    expect(tags?.['shinobi:node']).toBe('platform:my-workflow');
    expect(tags?.['shinobi:platform']).toBe('aws-stepfunctions');
  });

  it('sets sourceId to node ID for both resources', () => {
    const node = makeSfnNode();
    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0]?.sourceId).toBe('platform:my-workflow');
    expect(resources[1]?.sourceId).toBe('platform:my-workflow');
  });

  it('output is deterministic', () => {
    const node = makeSfnNode();
    const r1 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const r2 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});
