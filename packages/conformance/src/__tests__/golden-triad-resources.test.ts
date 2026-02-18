import { describe, it, expect } from 'vitest';
import type { GraphMutation } from '@shinobi/ir';
import { createTestNode, createTestEdge } from '@shinobi/ir';
import { ComponentPlatformBinder, TriggersBinder, BinderRegistry } from '@shinobi/binder';
import { BaselinePolicyEvaluator } from '@shinobi/policy';
import type { IBinder, IPolicyEvaluator } from '@shinobi/kernel';
import { runGoldenCase } from '../golden-runner';
import type { TriadCell } from '../types';

const PACKS = ['Baseline', 'FedRAMP-Moderate', 'FedRAMP-High'] as const;
type ScenarioName = 'dynamodb-read' | 's3-read' | 'sns-write' | 'apigw-trigger';

interface ResourceScenarioExpectation {
  readonly cell: TriadCell;
  readonly expectedIntentTypes: ReadonlyArray<string>;
  readonly expectedRuleIds: ReadonlyArray<string>;
}

function createBinderList(): ReadonlyArray<IBinder> {
  const registry = new BinderRegistry();
  registry.register(new ComponentPlatformBinder());
  registry.register(new TriggersBinder());
  return registry.getBinders();
}

function createEvaluatorList(): ReadonlyArray<IPolicyEvaluator> {
  return [new BaselinePolicyEvaluator()];
}

function createSetup(scenario: ScenarioName): () => ReadonlyArray<GraphMutation> {
  if (scenario === 'dynamodb-read') {
    return () => {
      const source = createTestNode({ id: 'component:orders-api', type: 'component' });
      const target = createTestNode({
        id: 'platform:orders-table',
        type: 'platform',
        metadata: { properties: { platform: 'aws-dynamodb' } },
      });
      const edge = createTestEdge({
        id: 'edge:bindsTo:component:orders-api:platform:orders-table',
        type: 'bindsTo',
        source: source.id,
        target: target.id,
        metadata: { bindingConfig: { resourceType: 'table', accessLevel: 'read' } },
      });
      return [
        { type: 'addNode', node: source },
        { type: 'addNode', node: target },
        { type: 'addEdge', edge },
      ];
    };
  }

  if (scenario === 's3-read') {
    return () => {
      const source = createTestNode({ id: 'component:asset-reader', type: 'component' });
      const target = createTestNode({
        id: 'platform:asset-bucket',
        type: 'platform',
        metadata: { properties: { platform: 'aws-s3' } },
      });
      const edge = createTestEdge({
        id: 'edge:bindsTo:component:asset-reader:platform:asset-bucket',
        type: 'bindsTo',
        source: source.id,
        target: target.id,
        metadata: { bindingConfig: { resourceType: 'bucket', accessLevel: 'read' } },
      });
      return [
        { type: 'addNode', node: source },
        { type: 'addNode', node: target },
        { type: 'addEdge', edge },
      ];
    };
  }

  if (scenario === 'sns-write') {
    return () => {
      const source = createTestNode({ id: 'component:notifier', type: 'component' });
      const target = createTestNode({
        id: 'platform:alerts-topic',
        type: 'platform',
        metadata: { properties: { platform: 'aws-sns' } },
      });
      const edge = createTestEdge({
        id: 'edge:bindsTo:component:notifier:platform:alerts-topic',
        type: 'bindsTo',
        source: source.id,
        target: target.id,
        metadata: { bindingConfig: { resourceType: 'topic', accessLevel: 'write' } },
      });
      return [
        { type: 'addNode', node: source },
        { type: 'addNode', node: target },
        { type: 'addEdge', edge },
      ];
    };
  }

  return () => {
    const source = createTestNode({
      id: 'platform:public-api',
      type: 'platform',
      metadata: { properties: { platform: 'aws-apigateway' } },
    });
    const target = createTestNode({
      id: 'component:handler',
      type: 'component',
      metadata: { properties: { platform: 'aws-lambda' } },
    });
    const edge = createTestEdge({
      id: 'edge:triggers:platform:public-api:component:handler',
      type: 'triggers',
      source: source.id,
      target: target.id,
      metadata: { bindingConfig: { resourceType: 'api', route: '/items', method: 'GET' } },
    });
    return [
      { type: 'addNode', node: source },
      { type: 'addNode', node: target },
      { type: 'addEdge', edge },
    ];
  };
}

const SCENARIOS: ReadonlyArray<ResourceScenarioExpectation> = PACKS.flatMap((policyPack) => [
  {
    cell: { scenario: 'dynamodb-read', policyPack },
    expectedIntentTypes: ['iam'],
    expectedRuleIds: ['iam-missing-conditions'],
  },
  {
    cell: { scenario: 's3-read', policyPack },
    expectedIntentTypes: ['iam'],
    expectedRuleIds: ['iam-missing-conditions'],
  },
  {
    cell: { scenario: 'sns-write', policyPack },
    expectedIntentTypes: ['iam'],
    expectedRuleIds: ['iam-missing-conditions'],
  },
  {
    cell: { scenario: 'apigw-trigger', policyPack },
    expectedIntentTypes: ['config', 'iam'],
    expectedRuleIds: ['iam-missing-conditions'],
  },
]);

describe('Golden: Triad Resource Expansion', () => {
  describe.each(SCENARIOS)('$cell.scenario × $cell.policyPack', ({ cell, expectedIntentTypes, expectedRuleIds }) => {
    it('produces expected intent families for the scenario', () => {
      const { compilation } = runGoldenCase({
        setup: createSetup(cell.scenario as ScenarioName),
        config: { policyPack: cell.policyPack },
        binders: createBinderList(),
        evaluators: createEvaluatorList(),
      });

      const intentTypes = [...new Set(compilation.intents.map((intent) => intent.type))].sort();
      expect(intentTypes).toEqual(expectedIntentTypes);
    });

    it('produces expected policy rule set for scenario', () => {
      const { compilation } = runGoldenCase({
        setup: createSetup(cell.scenario as ScenarioName),
        config: { policyPack: cell.policyPack },
        binders: createBinderList(),
        evaluators: createEvaluatorList(),
      });

      const ruleIds = (compilation.policy?.violations ?? []).map((v) => v.ruleId).sort();
      expect(ruleIds).toEqual(expectedRuleIds);
    });

    it('determinism: scenario output is byte-stable', () => {
      const opts = {
        setup: createSetup(cell.scenario as ScenarioName),
        config: { policyPack: cell.policyPack },
        binders: createBinderList(),
        evaluators: createEvaluatorList(),
      };
      const r1 = runGoldenCase(opts);
      const r2 = runGoldenCase(opts);
      expect(r1.serialized).toBe(r2.serialized);
    });
  });
});
