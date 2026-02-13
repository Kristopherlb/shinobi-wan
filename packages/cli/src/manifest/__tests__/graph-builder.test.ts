import { describe, it, expect } from 'vitest';
import { manifestToMutations } from '../graph-builder';
import { parseManifest } from '../parser';
import { Kernel } from '@shinobi/kernel';
import type { IBinder, IPolicyEvaluator } from '@shinobi/kernel';
import { ComponentPlatformBinder, BinderRegistry } from '@shinobi/binder';
import { BaselinePolicyEvaluator } from '@shinobi/policy';
import type { ServiceManifest } from '../types';

const LAMBDA_SQS_YAML = `
service: my-lambda-sqs
components:
  - id: api-handler
    type: component
    platform: aws-lambda
    config:
      runtime: nodejs20.x
      handler: index.handler
      memorySize: 256
      timeout: 30
  - id: work-queue
    type: platform
    platform: aws-sqs
    config:
      visibilityTimeout: 300
bindings:
  - source: api-handler
    target: work-queue
    type: bindsTo
    config:
      resourceType: queue
      accessLevel: write
      network:
        port: 443
        protocol: tcp
      configKeys:
        - key: QUEUE_URL
          valueSource:
            type: reference
            nodeRef: work-queue
            field: url
policyPack: Baseline
`;

function createBinders(): ReadonlyArray<IBinder> {
  const registry = new BinderRegistry();
  registry.register(new ComponentPlatformBinder());
  return registry.getBinders();
}

function createEvaluators(): ReadonlyArray<IPolicyEvaluator> {
  return [new BaselinePolicyEvaluator()];
}

function parseOrThrow(yaml: string): ServiceManifest {
  const result = parseManifest(yaml);
  if (!result.ok) throw new Error(`Parse failed: ${result.errors.map((e) => e.message).join(', ')}`);
  return result.manifest;
}

describe('manifestToMutations', () => {
  it('produces addNode mutations for each component', () => {
    const manifest = parseOrThrow(LAMBDA_SQS_YAML);
    const mutations = manifestToMutations(manifest);

    const nodeMutations = mutations.filter((m) => m.type === 'addNode');
    expect(nodeMutations).toHaveLength(2);

    const nodeIds = nodeMutations.map((m) => m.type === 'addNode' ? m.node.id : '');
    expect(nodeIds).toContain('component:api-handler');
    expect(nodeIds).toContain('platform:work-queue');
  });

  it('produces addEdge mutations for each binding', () => {
    const manifest = parseOrThrow(LAMBDA_SQS_YAML);
    const mutations = manifestToMutations(manifest);

    const edgeMutations = mutations.filter((m) => m.type === 'addEdge');
    expect(edgeMutations).toHaveLength(1);

    const edge = edgeMutations[0].type === 'addEdge' ? edgeMutations[0].edge : undefined;
    expect(edge?.id).toBe('edge:bindsTo:component:api-handler:platform:work-queue');
    expect(edge?.type).toBe('bindsTo');
    expect(edge?.source).toBe('component:api-handler');
    expect(edge?.target).toBe('platform:work-queue');
  });

  it('nodes are ordered before edges', () => {
    const manifest = parseOrThrow(LAMBDA_SQS_YAML);
    const mutations = manifestToMutations(manifest);

    const types = mutations.map((m) => m.type);
    const lastNodeIndex = types.lastIndexOf('addNode');
    const firstEdgeIndex = types.indexOf('addEdge');
    expect(lastNodeIndex).toBeLessThan(firstEdgeIndex);
  });

  it('node metadata includes platform and config properties', () => {
    const manifest = parseOrThrow(LAMBDA_SQS_YAML);
    const mutations = manifestToMutations(manifest);

    const lambdaNode = mutations
      .filter((m) => m.type === 'addNode')
      .map((m) => m.type === 'addNode' ? m.node : undefined)
      .find((n) => n?.id === 'component:api-handler');

    expect(lambdaNode?.metadata.properties).toEqual({
      platform: 'aws-lambda',
      runtime: 'nodejs20.x',
      handler: 'index.handler',
      memorySize: 256,
      timeout: 30,
    });
  });

  it('edge metadata includes bindingConfig', () => {
    const manifest = parseOrThrow(LAMBDA_SQS_YAML);
    const mutations = manifestToMutations(manifest);

    const edgeMutation = mutations.find((m) => m.type === 'addEdge');
    const edge = edgeMutation?.type === 'addEdge' ? edgeMutation.edge : undefined;

    expect(edge?.metadata.bindingConfig).toEqual({
      resourceType: 'queue',
      accessLevel: 'write',
      network: { port: 443, protocol: 'tcp' },
      configKeys: [
        {
          key: 'QUEUE_URL',
          valueSource: { type: 'reference', nodeRef: 'work-queue', field: 'url' },
        },
      ],
    });
  });

  it('all nodes have valid semanticHash', () => {
    const manifest = parseOrThrow(LAMBDA_SQS_YAML);
    const mutations = manifestToMutations(manifest);

    for (const m of mutations) {
      if (m.type === 'addNode') {
        expect(m.node.semanticHash).toMatch(/^sha256:[a-f0-9]{64}$/);
      }
      if (m.type === 'addEdge') {
        expect(m.edge.semanticHash).toMatch(/^sha256:[a-f0-9]{64}$/);
      }
    }
  });

  it('all entities have schemaVersion 1.0.0', () => {
    const manifest = parseOrThrow(LAMBDA_SQS_YAML);
    const mutations = manifestToMutations(manifest);

    for (const m of mutations) {
      if (m.type === 'addNode') expect(m.node.schemaVersion).toBe('1.0.0');
      if (m.type === 'addEdge') expect(m.edge.schemaVersion).toBe('1.0.0');
    }
  });

  it('determinism: identical input produces identical mutations', () => {
    const manifest = parseOrThrow(LAMBDA_SQS_YAML);
    const m1 = manifestToMutations(manifest);
    const m2 = manifestToMutations(manifest);
    expect(JSON.stringify(m1)).toBe(JSON.stringify(m2));
  });

  describe('kernel integration', () => {
    it('mutations can be applied to a Kernel instance', () => {
      const manifest = parseOrThrow(LAMBDA_SQS_YAML);
      const mutations = manifestToMutations(manifest);

      const kernel = new Kernel({
        binders: createBinders(),
        evaluators: createEvaluators(),
        config: { policyPack: manifest.policyPack },
      });

      const result = kernel.applyMutation(mutations);
      expect(result.success).toBe(true);
      expect(result.appliedCount).toBe(3); // 2 nodes + 1 edge
    });

    it('kernel validates the graph after manifest import', () => {
      const manifest = parseOrThrow(LAMBDA_SQS_YAML);
      const mutations = manifestToMutations(manifest);

      const kernel = new Kernel({
        binders: createBinders(),
        evaluators: createEvaluators(),
        config: { policyPack: manifest.policyPack },
      });

      kernel.applyMutation(mutations);
      const validation = kernel.validate();
      expect(validation.valid).toBe(true);
    });

    it('full compilation pipeline succeeds on manifest input', () => {
      const manifest = parseOrThrow(LAMBDA_SQS_YAML);
      const mutations = manifestToMutations(manifest);

      const kernel = new Kernel({
        binders: createBinders(),
        evaluators: createEvaluators(),
        config: { policyPack: manifest.policyPack },
      });

      kernel.applyMutation(mutations);
      const compilation = kernel.compile();

      // Should have intents from the binder
      expect(compilation.intents.length).toBeGreaterThan(0);

      // Should have policy results
      expect(compilation.policy).toBeDefined();
      expect(compilation.policy?.policyPack).toBe('Baseline');

      // Should be compliant under Baseline
      expect(compilation.policy?.compliant).toBe(true);
    });

    it('compilation produces IAM, network, and config intents', () => {
      const manifest = parseOrThrow(LAMBDA_SQS_YAML);
      const mutations = manifestToMutations(manifest);

      const kernel = new Kernel({
        binders: createBinders(),
        evaluators: createEvaluators(),
        config: { policyPack: manifest.policyPack },
      });

      kernel.applyMutation(mutations);
      const compilation = kernel.compile();

      const intentTypes = new Set(compilation.intents.map((i) => i.type));
      expect(intentTypes.has('iam')).toBe(true);
      expect(intentTypes.has('network')).toBe(true);
      expect(intentTypes.has('config')).toBe(true);
    });

    it('mutations are idempotent through the kernel', () => {
      const manifest = parseOrThrow(LAMBDA_SQS_YAML);
      const mutations = manifestToMutations(manifest);

      const kernel = new Kernel({
        binders: createBinders(),
        evaluators: createEvaluators(),
        config: { policyPack: manifest.policyPack },
      });

      const r1 = kernel.applyMutation(mutations);
      const r2 = kernel.applyMutation(mutations);

      expect(r1.success).toBe(true);
      expect(r2.success).toBe(true);
      expect(r2.skippedCount).toBe(3); // All 3 mutations idempotently skipped
    });
  });
});
