import { describe, it, expect } from 'vitest';
import type { GraphMutation } from '@shinobi/ir';
import { createTestNode, createTestEdge } from '@shinobi/ir';
import { ComponentPlatformBinder, BinderRegistry } from '@shinobi/binder';
import { BaselinePolicyEvaluator } from '@shinobi/policy';
import type { IBinder, IPolicyEvaluator } from '@shinobi/kernel';
import { runGoldenCase } from '../golden-runner';
import type { TriadCell, GoldenCase } from '../types';

/*──────────────────────────────────────────────────────────────────────────────
 * G-040 (GOLDEN)  – Policy violation detected and reported
 * G-041 (SCHEMA)  – Compliance status block structure
 *
 * Triad matrix: 2 scenarios × 3 policy packs = 6 cells
 *────────────────────────────────────────────────────────────────────────────*/

// ── Shared setup ─────────────────────────────────────────────────────────────

function createBinderList(): ReadonlyArray<IBinder> {
  const registry = new BinderRegistry();
  registry.register(new ComponentPlatformBinder());
  return registry.getBinders();
}

function createEvaluatorList(): ReadonlyArray<IPolicyEvaluator> {
  return [new BaselinePolicyEvaluator()];
}

// ── Scenario: admin-wildcard ─────────────────────────────────────────────────
// component→platform with accessLevel:'admin', protocol:'any'
// Triggers all 4 rules: iam-no-wildcard-resource, iam-admin-access-review,
//   iam-missing-conditions, network-broad-protocol

function adminWildcardSetup(): ReadonlyArray<GraphMutation> {
  const source = createTestNode({ id: 'component:admin-svc', type: 'component' });
  const target = createTestNode({ id: 'platform:aws-sqs', type: 'platform' });
  const edge = createTestEdge({
    id: 'edge:bindsTo:component:admin-svc:platform:aws-sqs',
    type: 'bindsTo',
    source: source.id,
    target: target.id,
    metadata: {
      bindingConfig: {
        resourceType: 'queue',
        accessLevel: 'admin',
        network: { port: 443, protocol: 'any' },
      },
    },
  });

  return [
    { type: 'addNode', node: source },
    { type: 'addNode', node: target },
    { type: 'addEdge', edge },
  ];
}

// ── Scenario: clean-read ─────────────────────────────────────────────────────
// component→platform with accessLevel:'read', protocol:'tcp'
// Triggers only iam-missing-conditions (cross-service, no conditions)

function cleanReadSetup(): ReadonlyArray<GraphMutation> {
  const source = createTestNode({ id: 'component:clean-svc', type: 'component' });
  const target = createTestNode({ id: 'platform:clean-db', type: 'platform' });
  const edge = createTestEdge({
    id: 'edge:bindsTo:component:clean-svc:platform:clean-db',
    type: 'bindsTo',
    source: source.id,
    target: target.id,
    metadata: {
      bindingConfig: {
        resourceType: 'table',
        accessLevel: 'read',
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

// ── Expected violation data per triad cell ───────────────────────────────────

const PACKS = ['Baseline', 'FedRAMP-Moderate', 'FedRAMP-High'] as const;

const CASE_SCHEMA: GoldenCase = {
  id: 'golden:triad:matrix',
  description: 'Policy violations and compliance blocks are stable across scenario × pack matrix',
  gates: ['G-040', 'G-041'],
};

interface CellExpectation {
  readonly cell: TriadCell;
  readonly expectedRuleIds: ReadonlyArray<string>;
  readonly expectedCompliant: boolean;
  readonly expectedSeverities: Record<string, string>;
}

const ADMIN_WILDCARD_EXPECTATIONS: ReadonlyArray<CellExpectation> = [
  {
    cell: { scenario: 'admin-wildcard', policyPack: 'Baseline' },
    // Binder always emits scope:'specific', so iam-no-wildcard-resource never fires.
    // admin + protocol:'any' triggers: iam-admin-access-review, iam-missing-conditions, network-broad-protocol
    expectedRuleIds: [
      'iam-admin-access-review',
      'iam-missing-conditions',
      'network-broad-protocol',
    ],
    expectedCompliant: true, // Baseline has no 'error' severity
    expectedSeverities: {
      'iam-admin-access-review': 'info',
      'iam-missing-conditions': 'info',
      'network-broad-protocol': 'info',
    },
  },
  {
    cell: { scenario: 'admin-wildcard', policyPack: 'FedRAMP-Moderate' },
    expectedRuleIds: [
      'iam-admin-access-review',
      'iam-missing-conditions',
      'network-broad-protocol',
    ],
    expectedCompliant: true, // FedRAMP-Moderate: all warnings, no errors
    expectedSeverities: {
      'iam-admin-access-review': 'warning',
      'iam-missing-conditions': 'warning',
      'network-broad-protocol': 'warning',
    },
  },
  {
    cell: { scenario: 'admin-wildcard', policyPack: 'FedRAMP-High' },
    expectedRuleIds: [
      'iam-admin-access-review',
      'iam-missing-conditions',
      'network-broad-protocol',
    ],
    expectedCompliant: false, // FedRAMP-High: all errors
    expectedSeverities: {
      'iam-admin-access-review': 'error',
      'iam-missing-conditions': 'error',
      'network-broad-protocol': 'error',
    },
  },
];

const CLEAN_READ_EXPECTATIONS: ReadonlyArray<CellExpectation> = [
  {
    cell: { scenario: 'clean-read', policyPack: 'Baseline' },
    expectedRuleIds: ['iam-missing-conditions'],
    expectedCompliant: true,
    expectedSeverities: { 'iam-missing-conditions': 'info' },
  },
  {
    cell: { scenario: 'clean-read', policyPack: 'FedRAMP-Moderate' },
    expectedRuleIds: ['iam-missing-conditions'],
    expectedCompliant: true, // Only warning, no error
    expectedSeverities: { 'iam-missing-conditions': 'warning' },
  },
  {
    cell: { scenario: 'clean-read', policyPack: 'FedRAMP-High' },
    expectedRuleIds: ['iam-missing-conditions'],
    expectedCompliant: false, // error severity
    expectedSeverities: { 'iam-missing-conditions': 'error' },
  },
];

// ── Scenario: wildcard-resource ─────────────────────────────────────────────
// component→platform with accessLevel:'read', scope:'pattern', protocol:'tcp'
// Triggers: iam-no-wildcard-resource (pattern scope) + iam-missing-conditions (cross-service)
// Does NOT trigger: iam-admin-access-review (read, not admin), network-broad-protocol (tcp, not any)

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

const WILDCARD_RESOURCE_EXPECTATIONS: ReadonlyArray<CellExpectation> = [
  {
    cell: { scenario: 'wildcard-resource', policyPack: 'Baseline' },
    expectedRuleIds: [
      'iam-missing-conditions',
      'iam-no-wildcard-resource',
    ],
    expectedCompliant: true, // Baseline: warning + info, no errors
    expectedSeverities: {
      'iam-no-wildcard-resource': 'warning',
      'iam-missing-conditions': 'info',
    },
  },
  {
    cell: { scenario: 'wildcard-resource', policyPack: 'FedRAMP-Moderate' },
    expectedRuleIds: [
      'iam-missing-conditions',
      'iam-no-wildcard-resource',
    ],
    expectedCompliant: false, // FedRAMP-Moderate: iam-no-wildcard-resource is error
    expectedSeverities: {
      'iam-no-wildcard-resource': 'error',
      'iam-missing-conditions': 'warning',
    },
  },
  {
    cell: { scenario: 'wildcard-resource', policyPack: 'FedRAMP-High' },
    expectedRuleIds: [
      'iam-missing-conditions',
      'iam-no-wildcard-resource',
    ],
    expectedCompliant: false, // FedRAMP-High: both errors
    expectedSeverities: {
      'iam-no-wildcard-resource': 'error',
      'iam-missing-conditions': 'error',
    },
  },
];

const ALL_EXPECTATIONS = [...ADMIN_WILDCARD_EXPECTATIONS, ...CLEAN_READ_EXPECTATIONS, ...WILDCARD_RESOURCE_EXPECTATIONS];

// ── Tests ────────────────────────────────────────────────────────────────────

describe(`Golden: Triad Matrix (G-040, G-041)`, () => {
  it('documents conformance gate coverage metadata', () => {
    expect(CASE_SCHEMA.gates).toEqual(['G-040', 'G-041']);
  });

  function getSetup(scenario: string) {
    if (scenario === 'admin-wildcard') return adminWildcardSetup;
    if (scenario === 'wildcard-resource') return wildcardResourceSetup;
    return cleanReadSetup;
  }

  describe.each(ALL_EXPECTATIONS)(
    '$cell.scenario × $cell.policyPack',
    ({ cell, expectedRuleIds, expectedCompliant, expectedSeverities }) => {
      it('G-040: correct violations detected', () => {
        const { compilation } = runGoldenCase({
          setup: getSetup(cell.scenario),
          config: { policyPack: cell.policyPack },
          binders: createBinderList(),
          evaluators: createEvaluatorList(),
        });

        const violations = compilation.policy?.violations ?? [];
        const ruleIds = violations.map((v) => v.ruleId).sort();

        expect(ruleIds).toEqual(expectedRuleIds);
      });

      it('G-040: correct severities per rule', () => {
        const { compilation } = runGoldenCase({
          setup: getSetup(cell.scenario),
          config: { policyPack: cell.policyPack },
          binders: createBinderList(),
          evaluators: createEvaluatorList(),
        });

        const violations = compilation.policy?.violations ?? [];
        for (const v of violations) {
          expect(v.severity).toBe(expectedSeverities[v.ruleId]);
        }
      });

      it('G-041: compliance status block is well-formed', () => {
        const { compilation } = runGoldenCase({
          setup: getSetup(cell.scenario),
          config: { policyPack: cell.policyPack },
          binders: createBinderList(),
          evaluators: createEvaluatorList(),
        });

        expect(compilation.policy).toBeDefined();
        expect(typeof compilation.policy?.compliant).toBe('boolean');
        expect(compilation.policy?.policyPack).toBe(cell.policyPack);
        expect(Array.isArray(compilation.policy?.violations)).toBe(true);
        expect(compilation.policy?.compliant).toBe(expectedCompliant);
      });

      it('G-041: all violations have correct schema structure', () => {
        const { compilation } = runGoldenCase({
          setup: getSetup(cell.scenario),
          config: { policyPack: cell.policyPack },
          binders: createBinderList(),
          evaluators: createEvaluatorList(),
        });

        for (const v of compilation.policy?.violations ?? []) {
          expect(v.id).toMatch(/^violation:/);
          expect(v.schemaVersion).toBe('1.0.0');
          expect(v.ruleId.length).toBeGreaterThan(0);
          expect(v.ruleName.length).toBeGreaterThan(0);
          expect(v.message.length).toBeGreaterThan(0);
          expect(v.remediation.summary.length).toBeGreaterThan(0);
          expect(v.target.type).toBe('edge');
          expect(v.policyPack).toBe(cell.policyPack);
        }
      });

      it('determinism: identical input produces byte-identical output', () => {
        const opts = {
          setup: getSetup(cell.scenario),
          config: { policyPack: cell.policyPack },
          binders: createBinderList(),
          evaluators: createEvaluatorList(),
        };

        const r1 = runGoldenCase(opts);
        const r2 = runGoldenCase(opts);

        expect(r1.serialized).toBe(r2.serialized);
        expect(r1.serialized).toMatchSnapshot();
      });
    }
  );

  describe('cross-cell: severity escalation (KL-008)', () => {
    it('admin-wildcard: same rules fire across all 3 packs, only severity differs', () => {
      const results = PACKS.map((pack) =>
        runGoldenCase({
          setup: adminWildcardSetup,
          config: { policyPack: pack },
          binders: createBinderList(),
          evaluators: createEvaluatorList(),
        })
      );

      // Same rule IDs across all packs
      const ruleIdSets = results.map((r) =>
        (r.compilation.policy?.violations ?? []).map((v) => v.ruleId).sort().join(',')
      );
      expect(new Set(ruleIdSets).size).toBe(1);

      // Severity escalates: Baseline has no errors, FedRAMP-High has all errors
      const baselineSeverities = results[0].compilation.policy?.violations.map((v) => v.severity) ?? [];
      const highSeverities = results[2].compilation.policy?.violations.map((v) => v.severity) ?? [];

      expect(baselineSeverities).not.toContain('error');
      expect(highSeverities.every((s) => s === 'error')).toBe(true);
    });

    it('wildcard-resource: iam-no-wildcard-resource severity escalates across packs', () => {
      const results = PACKS.map((pack) =>
        runGoldenCase({
          setup: wildcardResourceSetup,
          config: { policyPack: pack },
          binders: createBinderList(),
          evaluators: createEvaluatorList(),
        })
      );

      // Each pack should have exactly 2 violations
      for (const r of results) {
        expect(r.compilation.policy?.violations).toHaveLength(2);
      }

      // iam-no-wildcard-resource severity: warning → error → error
      const wildcardSeverities = results.map(
        (r) => r.compilation.policy?.violations.find((v) => v.ruleId === 'iam-no-wildcard-resource')?.severity
      );
      expect(wildcardSeverities).toEqual(['warning', 'error', 'error']);
    });

    it('clean-read: only iam-missing-conditions fires, severity escalates across packs', () => {
      const results = PACKS.map((pack) =>
        runGoldenCase({
          setup: cleanReadSetup,
          config: { policyPack: pack },
          binders: createBinderList(),
          evaluators: createEvaluatorList(),
        })
      );

      // Each pack should have exactly 1 violation
      for (const r of results) {
        expect(r.compilation.policy?.violations).toHaveLength(1);
        expect(r.compilation.policy?.violations[0].ruleId).toBe('iam-missing-conditions');
      }

      // Severity escalation: info → warning → error
      const severities = results.map(
        (r) => r.compilation.policy?.violations[0].severity
      );
      expect(severities).toEqual(['info', 'warning', 'error']);
    });
  });
});
