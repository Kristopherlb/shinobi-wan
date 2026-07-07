import { describe, it, expect } from 'vitest';
import { BudgetsLowerer } from '../lowerers/budgets-lowerer';
import { makeNode, makeDefaultContext, makeDefaultDeps } from './test-helpers';

const DEFAULT_CONTEXT = makeDefaultContext({
  adapterConfig: { region: 'us-east-1', serviceName: 'my-service' },
});
const DEFAULT_DEPS = makeDefaultDeps();

describe('BudgetsLowerer', () => {
  const lowerer = new BudgetsLowerer();

  it('has correct platform', () => {
    expect(lowerer.platform).toBe('aws-budgets');
  });

  it('produces Budget resource', () => {
    const node = makeNode({
      id: 'platform:monthly-budget',
      type: 'platform',
      metadata: { properties: { platform: 'aws-budgets' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources).toHaveLength(1);
    expect(resources[0].resourceType).toBe('aws:budgets:Budget');
  });

  it('uses correct naming convention', () => {
    const node = makeNode({
      id: 'platform:monthly-budget',
      type: 'platform',
      metadata: { properties: { platform: 'aws-budgets' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].name).toBe('monthly-budget-budget');
    expect(resources[0].properties['name']).toBe('my-service-monthly-budget');
  });

  it('uses default values', () => {
    const node = makeNode({
      id: 'platform:monthly-budget',
      type: 'platform',
      metadata: { properties: { platform: 'aws-budgets' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].properties['budgetType']).toBe('COST');
    expect(resources[0].properties['limitAmount']).toBe('100');
    expect(resources[0].properties['limitUnit']).toBe('USD');
    expect(resources[0].properties['timeUnit']).toBe('MONTHLY');
  });

  it('respects custom config', () => {
    const node = makeNode({
      id: 'platform:quarterly-budget',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-budgets',
          budgetType: 'USAGE',
          limitAmount: '500',
          limitUnit: 'USD',
          timeUnit: 'QUARTERLY',
        },
      },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].properties['budgetType']).toBe('USAGE');
    expect(resources[0].properties['limitAmount']).toBe('500');
    expect(resources[0].properties['timeUnit']).toBe('QUARTERLY');
  });

  it('adds notification when thresholdPercentage is set', () => {
    const node = makeNode({
      id: 'platform:monthly-budget',
      type: 'platform',
      metadata: {
        properties: { platform: 'aws-budgets', thresholdPercentage: 80 },
      },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const notifications = resources[0].properties['notifications'] as Record<
      string,
      unknown
    >[];
    expect(notifications).toHaveLength(1);
    expect(notifications[0]['threshold']).toBe(80);
    expect(notifications[0]['thresholdType']).toBe('PERCENTAGE');
  });

  it('adds SNS subscriber when notificationTopicArn is a platform ref', () => {
    const node = makeNode({
      id: 'platform:monthly-budget',
      type: 'platform',
      metadata: {
        properties: {
          platform: 'aws-budgets',
          thresholdPercentage: 80,
          notificationTopicArn: 'platform:alerts',
        },
      },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const subscribers = resources[0].properties['subscribers'] as Record<
      string,
      unknown
    >[];
    expect(subscribers).toHaveLength(1);
    expect(subscribers[0]['subscriptionType']).toBe('SNS');
    expect(subscribers[0]['address']).toEqual({ ref: 'alerts-topic' });
  });

  it('sets correct tags', () => {
    const node = makeNode({
      id: 'platform:monthly-budget',
      type: 'platform',
      metadata: { properties: { platform: 'aws-budgets' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = resources[0].properties['tags'] as Record<string, string>;
    expect(tags['shinobi:node']).toBe('platform:monthly-budget');
    expect(tags['shinobi:platform']).toBe('aws-budgets');
  });

  it('has no dependencies', () => {
    const node = makeNode({
      id: 'platform:monthly-budget',
      type: 'platform',
      metadata: { properties: { platform: 'aws-budgets' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].dependsOn).toEqual([]);
  });

  it('sets sourceId to node ID', () => {
    const node = makeNode({
      id: 'platform:monthly-budget',
      type: 'platform',
      metadata: { properties: { platform: 'aws-budgets' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].sourceId).toBe('platform:monthly-budget');
  });

  it('output is deterministic', () => {
    const node = makeNode({
      id: 'platform:monthly-budget',
      type: 'platform',
      metadata: {
        properties: { platform: 'aws-budgets', thresholdPercentage: 80 },
      },
    });

    const r1 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const r2 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});
