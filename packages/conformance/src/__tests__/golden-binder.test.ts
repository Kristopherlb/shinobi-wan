import { describe, it, expect } from 'vitest';
import type { IamIntent, NetworkIntent, ConfigIntent } from '@shinobi/contracts';
import type { GraphMutation } from '@shinobi/ir';
import { createTestNode, createTestEdge } from '@shinobi/ir';
import { ComponentPlatformBinder, BinderRegistry } from '@shinobi/binder';
import { runGoldenCase } from '../golden-runner';
import type { GoldenCase } from '../types';

/*──────────────────────────────────────────────────────────────────────────────
 * G-020 (COMPAT)     – Binder declares compatibility matrix
 * G-022 (DETERMINISM) – Binder output is deterministic
 * G-023 (GOLDEN)      – Binder emits required intents
 *────────────────────────────────────────────────────────────────────────────*/

function binderSetup(): ReadonlyArray<GraphMutation> {
  const source = createTestNode({ id: 'component:my-svc', type: 'component' });
  const target = createTestNode({ id: 'platform:aws-sqs', type: 'platform' });
  const edge = createTestEdge({
    id: 'edge:bindsTo:component:my-svc:platform:aws-sqs',
    type: 'bindsTo',
    source: source.id,
    target: target.id,
    metadata: {
      bindingConfig: {
        resourceType: 'queue',
        accessLevel: 'write',
        network: { port: 443, protocol: 'tcp' },
        configKeys: [
          {
            key: 'QUEUE_URL',
            valueSource: {
              type: 'reference',
              nodeRef: 'platform:aws-sqs',
              field: 'url',
            },
          },
        ],
      },
    },
  });

  return [
    { type: 'addNode', node: source },
    { type: 'addNode', node: target },
    { type: 'addEdge', edge },
  ];
}

function createBinders() {
  const registry = new BinderRegistry();
  registry.register(new ComponentPlatformBinder());
  return registry.getBinders();
}

describe('Golden: Binder (G-020, G-022, G-023)', () => {
  const CASE_COMPAT: GoldenCase = {
    id: 'golden:binder:compat-matrix',
    description: 'ComponentPlatformBinder declares explicit edge type support',
    gates: ['G-020'],
  };

  const CASE_DETERMINISM: GoldenCase = {
    id: 'golden:binder:determinism',
    description: 'Binder output is deterministic across runs',
    gates: ['G-022'],
  };

  const CASE_INTENTS: GoldenCase = {
    id: 'golden:binder:required-intents',
    description: 'Binder emits config, iam, and network intents in canonical order',
    gates: ['G-023'],
  };

  describe(`${CASE_COMPAT.id} — ${CASE_COMPAT.description}`, () => {
    it('G-020: ComponentPlatformBinder declares supportedEdgeTypes', () => {
      const binder = new ComponentPlatformBinder();

      expect(binder.supportedEdgeTypes).toBeDefined();
      expect(binder.supportedEdgeTypes.length).toBeGreaterThan(0);

      const pattern = binder.supportedEdgeTypes[0];
      expect(pattern.edgeType).toBe('bindsTo');
      expect(pattern.sourceType).toBe('component');
      expect(pattern.targetType).toBe('platform');
    });

    it('G-020: BinderRegistry can look up by edge pattern', () => {
      const registry = new BinderRegistry();
      registry.register(new ComponentPlatformBinder());

      const found = registry.findBinder('bindsTo', 'component', 'platform');
      expect(found).toBeDefined();
      expect(found?.id).toBe('component-platform-binder');

      // Non-matching pattern returns undefined
      const notFound = registry.findBinder('triggers', 'component', 'component');
      expect(notFound).toBeUndefined();
    });
  });

  describe(`${CASE_DETERMINISM.id} — ${CASE_DETERMINISM.description}`, () => {
    it('G-022: two identical compilations with binder produce byte-identical JSON', () => {
      const r1 = runGoldenCase({ setup: binderSetup, binders: createBinders() });
      const r2 = runGoldenCase({ setup: binderSetup, binders: createBinders() });

      expect(r1.serialized).toBe(r2.serialized);
      expect(r1.serialized).toMatchSnapshot();
    });

    it('G-022: intents are in identical order across runs', () => {
      const r1 = runGoldenCase({ setup: binderSetup, binders: createBinders() });
      const r2 = runGoldenCase({ setup: binderSetup, binders: createBinders() });

      const types1 = r1.compilation.intents.map((i) => i.type);
      const types2 = r2.compilation.intents.map((i) => i.type);
      expect(types1).toEqual(types2);
    });
  });

  describe(`${CASE_INTENTS.id} — ${CASE_INTENTS.description}`, () => {
    it('G-023: produces exactly 3 intents: config, iam, network', () => {
      const { compilation } = runGoldenCase({
        setup: binderSetup,
        binders: createBinders(),
      });

      expect(compilation.intents).toHaveLength(3);

      const types = compilation.intents.map((i) => i.type);
      // Canonical order: config < iam < network
      expect(types).toEqual(['config', 'iam', 'network']);
    });

    it('G-023: IAM intent has correct structure', () => {
      const { compilation } = runGoldenCase({
        setup: binderSetup,
        binders: createBinders(),
      });

      const iam = compilation.intents.find((i) => i.type === 'iam') as IamIntent;
      expect(iam).toBeDefined();
      expect(iam.schemaVersion).toBe('1.0.0');
      expect(iam.sourceEdgeId).toBe('edge:bindsTo:component:my-svc:platform:aws-sqs');
      expect(iam.principal.nodeRef).toBe('component:my-svc');
      expect(iam.resource.nodeRef).toBe('platform:aws-sqs');
      expect(iam.resource.resourceType).toBe('queue');
      // write → ['read', 'write']
      expect(iam.actions).toEqual([
        { level: 'read', action: 'read' },
        { level: 'write', action: 'write' },
      ]);
    });

    it('G-023: network intent has correct structure', () => {
      const { compilation } = runGoldenCase({
        setup: binderSetup,
        binders: createBinders(),
      });

      const net = compilation.intents.find((i) => i.type === 'network') as NetworkIntent;
      expect(net).toBeDefined();
      expect(net.schemaVersion).toBe('1.0.0');
      expect(net.sourceEdgeId).toBe('edge:bindsTo:component:my-svc:platform:aws-sqs');
      expect(net.direction).toBe('egress');
      expect(net.source.nodeRef).toBe('component:my-svc');
      expect(net.destination.nodeRef).toBe('platform:aws-sqs');
    });

    it('G-023: config intent has correct structure', () => {
      const { compilation } = runGoldenCase({
        setup: binderSetup,
        binders: createBinders(),
      });

      const cfg = compilation.intents.find((i) => i.type === 'config') as ConfigIntent;
      expect(cfg).toBeDefined();
      expect(cfg.schemaVersion).toBe('1.0.0');
      expect(cfg.sourceEdgeId).toBe('edge:bindsTo:component:my-svc:platform:aws-sqs');
      expect(cfg.targetNodeRef).toBe('component:my-svc');
      expect(cfg.key).toBe('QUEUE_URL');
    });

    it('G-023: no backend-specific handles in intents (KL-004)', () => {
      const { compilation } = runGoldenCase({
        setup: binderSetup,
        binders: createBinders(),
      });

      const serialized = JSON.stringify(compilation.intents);
      // No provider-specific patterns should appear
      expect(serialized).not.toContain('arn:');
      expect(serialized).not.toContain('aws:');
      expect(serialized).not.toContain('pulumi.');
    });
  });
});
