import { describe, it, expect } from 'vitest';
import type { GraphMutation } from '@shinobi/ir';
import { createTestNode, createTestEdge } from '@shinobi/ir';
import { ComponentPlatformBinder, BinderRegistry } from '@shinobi/binder';
import { BaselinePolicyEvaluator } from '@shinobi/policy';
import type { IBinder, IPolicyEvaluator } from '@shinobi/kernel';
import { validateViolationSchema } from '@shinobi/validation';
import { runGoldenCase } from '../golden-runner';
import type { GoldenCase } from '../types';

const CASE_SCHEMA: GoldenCase = {
  id: 'golden:policy:audit-severity-matrix',
  description: 'Violation schema and severity escalation remain stable across policy packs',
  gates: ['G-042'],
};

const PACKS = ['Baseline', 'FedRAMP-Moderate', 'FedRAMP-High'] as const;

function createBinderList(): ReadonlyArray<IBinder> {
  const registry = new BinderRegistry();
  registry.register(new ComponentPlatformBinder());
  return registry.getBinders();
}

function createEvaluatorList(): ReadonlyArray<IPolicyEvaluator> {
  return [new BaselinePolicyEvaluator()];
}

function wildcardResourceSetup(): ReadonlyArray<GraphMutation> {
  const source = createTestNode({ id: 'component:wildcard-svc', type: 'component' });
  const target = createTestNode({ id: 'platform:wildcard-db', type: 'platform' });
  const edge = createTestEdge({
    id: 'edge:bindsTo:component:wildcard-svc:platform:wildcard-db',
    type: 'bindsTo',
    source: source.id,
    target: target.id,
    metadata: {
      bindingConfig: {
        resourceType: 'table',
        accessLevel: 'read',
        scope: 'pattern',
        network: { port: 5432, protocol: 'tcp' },
      },
    },
  });

  return [
    { type: 'addNode', node: source },
    { type: 'addNode', node: target },
    { type: 'addEdge', edge },
  ];
}

describe(`Golden: Policy Audit Severity Matrix (G-042)`, () => {
  describe(`${CASE_SCHEMA.id} — ${CASE_SCHEMA.description}`, () => {
    it('G-042: validates all emitted violations against schema', () => {
      const { compilation } = runGoldenCase({
        setup: wildcardResourceSetup,
        config: { policyPack: 'FedRAMP-High' },
        binders: createBinderList(),
        evaluators: createEvaluatorList(),
      });

      const violations = compilation.policy?.violations ?? [];
      expect(violations.length).toBeGreaterThan(0);
      for (const violation of violations) {
        const result = validateViolationSchema(violation);
        expect(result.valid).toBe(true);
      }
    });

    it('G-042: severity for iam-no-wildcard-resource escalates Baseline -> Moderate -> High', () => {
      const severities = PACKS.map((pack) => {
        const { compilation } = runGoldenCase({
          setup: wildcardResourceSetup,
          config: { policyPack: pack },
          binders: createBinderList(),
          evaluators: createEvaluatorList(),
        });

        return compilation.policy?.violations.find((v) => v.ruleId === 'iam-no-wildcard-resource')?.severity;
      });

      expect(severities).toEqual(['warning', 'error', 'error']);
    });

    it('G-042: emitted violations include policyPack context and stable schemaVersion', () => {
      for (const pack of PACKS) {
        const { compilation } = runGoldenCase({
          setup: wildcardResourceSetup,
          config: { policyPack: pack },
          binders: createBinderList(),
          evaluators: createEvaluatorList(),
        });

        for (const violation of compilation.policy?.violations ?? []) {
          expect(violation.policyPack).toBe(pack);
          expect(violation.schemaVersion).toBe('1.0.0');
        }
      }
    });

    it('determinism: identical G-042 input produces byte-identical output', () => {
      const opts = {
        setup: wildcardResourceSetup,
        config: { policyPack: 'FedRAMP-High' as const },
        binders: createBinderList(),
        evaluators: createEvaluatorList(),
      };
      const r1 = runGoldenCase(opts);
      const r2 = runGoldenCase(opts);
      expect(r1.serialized).toBe(r2.serialized);
    });
  });
});
