import { describe, it, expect } from 'vitest';
import { createTestNode, createTestEdge } from '@shinobi/ir';
import type { GraphMutation } from '@shinobi/ir';
import { BinderRegistry, ComponentPlatformBinder, TriggersBinder } from '@shinobi/binder';
import { runGoldenCase } from '../golden-runner';
import type { GoldenCase } from '../types';

const CASE_DIRECTIVE: GoldenCase = {
  id: 'golden:binder:directive-validation',
  description: 'Binder inputs match directive schema, invalid configs produce deterministic diagnostics',
  gates: ['G-021'],
};

function createBinderList() {
  const registry = new BinderRegistry();
  registry.register(new ComponentPlatformBinder());
  registry.register(new TriggersBinder());
  return registry.getBinders();
}

// ── CPB: missing resourceType ───────────────────────────────────────────────

function cpbMissingResourceTypeSetup(): ReadonlyArray<GraphMutation> {
  const source = createTestNode({ id: 'component:svc', type: 'component' });
  const target = createTestNode({ id: 'platform:db', type: 'platform' });
  const edge = createTestEdge({
    id: 'edge:bindsTo:component:svc:platform:db',
    type: 'bindsTo',
    source: source.id,
    target: target.id,
    metadata: {
      bindingConfig: {
        // Missing resourceType
      },
    },
  });

  return [
    { type: 'addNode', node: source },
    { type: 'addNode', node: target },
    { type: 'addEdge', edge },
  ];
}

// ── CPB: valid directive ────────────────────────────────────────────────────

function cpbValidSetup(): ReadonlyArray<GraphMutation> {
  const source = createTestNode({ id: 'component:svc', type: 'component' });
  const target = createTestNode({ id: 'platform:db', type: 'platform' });
  const edge = createTestEdge({
    id: 'edge:bindsTo:component:svc:platform:db',
    type: 'bindsTo',
    source: source.id,
    target: target.id,
    metadata: {
      bindingConfig: {
        resourceType: 'table',
        accessLevel: 'read',
        network: { port: 443, protocol: 'tcp' },
      },
    },
  });

  return [
    { type: 'addNode', node: source },
    { type: 'addNode', node: target },
    { type: 'addEdge', edge },
  ];
}

// ── Triggers: missing resourceType ──────────────────────────────────────────

function triggersMissingResourceTypeSetup(): ReadonlyArray<GraphMutation> {
  const source = createTestNode({ id: 'platform:gw', type: 'platform' });
  const target = createTestNode({ id: 'component:handler', type: 'component' });
  const edge = createTestEdge({
    id: 'edge:triggers:platform:gw:component:handler',
    type: 'triggers',
    source: source.id,
    target: target.id,
    metadata: {
      bindingConfig: {
        // Missing resourceType
      },
    },
  });

  return [
    { type: 'addNode', node: source },
    { type: 'addNode', node: target },
    { type: 'addEdge', edge },
  ];
}

// ── Triggers: valid directive ───────────────────────────────────────────────

function triggersValidSetup(): ReadonlyArray<GraphMutation> {
  const source = createTestNode({ id: 'platform:gw', type: 'platform' });
  const target = createTestNode({ id: 'component:handler', type: 'component' });
  const edge = createTestEdge({
    id: 'edge:triggers:platform:gw:component:handler',
    type: 'triggers',
    source: source.id,
    target: target.id,
    metadata: {
      bindingConfig: {
        resourceType: 'api',
        route: '/items',
        method: 'GET',
      },
    },
  });

  return [
    { type: 'addNode', node: source },
    { type: 'addNode', node: target },
    { type: 'addEdge', edge },
  ];
}

describe(`Golden: Binder Directive Validation (G-021)`, () => {
  describe(`${CASE_DIRECTIVE.id} — ${CASE_DIRECTIVE.description}`, () => {
    describe('ComponentPlatformBinder', () => {
      it('G-021: missing resourceType produces error diagnostic', () => {
        const { compilation } = runGoldenCase({
          setup: cpbMissingResourceTypeSetup,
          binders: createBinderList(),
        });

        const diag = compilation.bindingDiagnostics.find(
          (d) => d.rule === 'missing-resource-type',
        );
        expect(diag).toBeDefined();
        expect(diag?.severity).toBe('error');
      });

      it('G-021: error diagnostic has stable path', () => {
        const { compilation } = runGoldenCase({
          setup: cpbMissingResourceTypeSetup,
          binders: createBinderList(),
        });

        const diag = compilation.bindingDiagnostics.find(
          (d) => d.rule === 'missing-resource-type',
        );
        expect(diag?.path).toContain('resourceType');
        expect(diag?.path).toMatch(/^\$\.edges\[/);
      });

      it('G-021: valid directive produces 0 diagnostics', () => {
        const { compilation } = runGoldenCase({
          setup: cpbValidSetup,
          binders: createBinderList(),
        });

        expect(compilation.bindingDiagnostics).toHaveLength(0);
      });

      it('G-021: diagnostic output is deterministic', () => {
        const r1 = runGoldenCase({
          setup: cpbMissingResourceTypeSetup,
          binders: createBinderList(),
        });
        const r2 = runGoldenCase({
          setup: cpbMissingResourceTypeSetup,
          binders: createBinderList(),
        });

        expect(JSON.stringify(r1.compilation.bindingDiagnostics)).toBe(
          JSON.stringify(r2.compilation.bindingDiagnostics),
        );
      });
    });

    describe('TriggersBinder', () => {
      it('G-021: missing resourceType produces error diagnostic', () => {
        const { compilation } = runGoldenCase({
          setup: triggersMissingResourceTypeSetup,
          binders: createBinderList(),
        });

        const diag = compilation.bindingDiagnostics.find(
          (d) => d.rule === 'missing-resource-type',
        );
        expect(diag).toBeDefined();
        expect(diag?.severity).toBe('error');
      });

      it('G-021: valid triggers directive produces 0 diagnostics', () => {
        const { compilation } = runGoldenCase({
          setup: triggersValidSetup,
          binders: createBinderList(),
        });

        expect(compilation.bindingDiagnostics).toHaveLength(0);
      });

      it('G-021: diagnostic output is deterministic', () => {
        const r1 = runGoldenCase({
          setup: triggersMissingResourceTypeSetup,
          binders: createBinderList(),
        });
        const r2 = runGoldenCase({
          setup: triggersMissingResourceTypeSetup,
          binders: createBinderList(),
        });

        expect(JSON.stringify(r1.compilation.bindingDiagnostics)).toBe(
          JSON.stringify(r2.compilation.bindingDiagnostics),
        );
      });
    });

    describe('Cross-binder', () => {
      it('G-021: all diagnostics have severity error or warning', () => {
        const { compilation } = runGoldenCase({
          setup: cpbMissingResourceTypeSetup,
          binders: createBinderList(),
        });

        for (const d of compilation.bindingDiagnostics) {
          expect(['error', 'warning']).toContain(d.severity);
        }
      });

      it('G-021: diagnostics contain non-empty message text', () => {
        const { compilation } = runGoldenCase({
          setup: cpbMissingResourceTypeSetup,
          binders: createBinderList(),
        });

        for (const d of compilation.bindingDiagnostics) {
          expect(d.message.length).toBeGreaterThan(0);
        }
      });

      it('G-021: same invalid input produces byte-identical diagnostics JSON', () => {
        const opts = {
          setup: cpbMissingResourceTypeSetup,
          binders: createBinderList(),
        };

        const r1 = runGoldenCase(opts);
        const r2 = runGoldenCase(opts);
        expect(r1.serialized).toBe(r2.serialized);
      });
    });
  });
});
