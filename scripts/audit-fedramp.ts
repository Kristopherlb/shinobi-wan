#!/usr/bin/env npx tsx
/**
 * FedRAMP Compliance Audit Script
 *
 * Validates every blueprint against all 3 policy packs and reports:
 * - Which rules fire at each severity level
 * - Whether Baseline has no error-severity violations
 * - Expected vs actual violations per blueprint per pack
 *
 * Usage: npx tsx scripts/audit-fedramp.ts [blueprint-path]
 *        npx tsx scripts/audit-fedramp.ts                   # audits all blueprints
 *        npx tsx scripts/audit-fedramp.ts blueprints/compute/serverless-api-etl.yaml
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { createTestNode, createTestEdge } from '@shinobi/ir';
import type { GraphMutation } from '@shinobi/ir';
import { Kernel } from '@shinobi/kernel';
import {
  ComponentPlatformBinder,
  TriggersBinder,
  BinderRegistry,
} from '@shinobi/binder';
import { BaselinePolicyEvaluator } from '@shinobi/policy';
import type { Severity } from '@shinobi/contracts';

const PACKS = ['Baseline', 'FedRAMP-Moderate', 'FedRAMP-High'] as const;

interface ServiceManifest {
  service: string;
  components: Array<{
    id: string;
    type: string;
    platform: string;
    config?: Record<string, unknown>;
  }>;
  bindings: Array<{
    source: string;
    target: string;
    type: string;
    config?: Record<string, unknown>;
  }>;
  policyPack?: string;
}

interface AuditViolation {
  ruleId: string;
  severity: Severity;
  message: string;
  targetId: string;
}

interface PackAuditResult {
  policyPack: string;
  violations: AuditViolation[];
  hasErrors: boolean;
  compliant: boolean;
}

interface BlueprintAuditResult {
  blueprintPath: string;
  service: string;
  nodeCount: number;
  edgeCount: number;
  intentCount: number;
  packs: PackAuditResult[];
  baselineClean: boolean;
}

function manifestToMutations(manifest: ServiceManifest): GraphMutation[] {
  const mutations: GraphMutation[] = [];

  for (const comp of manifest.components) {
    const nodeId = `${comp.type}:${comp.id}`;
    const node = createTestNode({
      id: nodeId,
      type: comp.type as 'component' | 'platform',
      metadata: { properties: { platform: comp.platform, ...comp.config } },
    });
    mutations.push({ type: 'addNode', node });
  }

  for (const binding of manifest.bindings) {
    const sourceComp = manifest.components.find((c) => c.id === binding.source);
    const targetComp = manifest.components.find((c) => c.id === binding.target);
    if (!sourceComp || !targetComp) {
      console.error(
        `  WARNING: binding references unknown component: ${binding.source} → ${binding.target}`,
      );
      continue;
    }
    const sourceId = `${sourceComp.type}:${sourceComp.id}`;
    const targetId = `${targetComp.type}:${targetComp.id}`;
    const edgeId = `edge:${binding.type}:${sourceId}:${targetId}`;
    const edge = createTestEdge({
      id: edgeId,
      type: binding.type as 'bindsTo' | 'triggers',
      source: sourceId,
      target: targetId,
      metadata: { bindingConfig: binding.config ?? {} },
    });
    mutations.push({ type: 'addEdge', edge });
  }

  return mutations;
}

function auditBlueprint(blueprintPath: string): BlueprintAuditResult {
  const raw = fs.readFileSync(blueprintPath, 'utf8');
  const manifest = parseYaml(raw) as ServiceManifest;
  const mutations = manifestToMutations(manifest);

  const registry = new BinderRegistry();
  registry.register(new ComponentPlatformBinder());
  registry.register(new TriggersBinder());
  const binders = registry.getBinders();
  const evaluator = new BaselinePolicyEvaluator();

  const packResults: PackAuditResult[] = [];

  for (const pack of PACKS) {
    const kernel = new Kernel({
      config: { policyPack: pack },
      binders,
      evaluators: [evaluator],
    });
    kernel.applyMutation(mutations);
    const compilation = kernel.compile();

    const violations: AuditViolation[] = (
      compilation.policy?.violations ?? []
    ).map((v) => ({
      ruleId: v.ruleId,
      severity: v.severity,
      message: v.message,
      targetId: v.target?.id ?? 'unknown',
    }));

    const hasErrors = violations.some((v) => v.severity === 'error');
    const compliant = violations.every((v) => v.severity !== 'error');

    packResults.push({
      policyPack: pack,
      violations,
      hasErrors,
      compliant,
    });
  }

  const baselineResult = packResults.find((p) => p.policyPack === 'Baseline')!;

  // Get counts from last compilation
  const kernel = new Kernel({
    config: { policyPack: 'Baseline' },
    binders,
    evaluators: [evaluator],
  });
  kernel.applyMutation(mutations);
  const lastCompilation = kernel.compile();

  return {
    blueprintPath,
    service: manifest.service,
    nodeCount: lastCompilation.snapshot.nodes.length,
    edgeCount: lastCompilation.snapshot.edges.length,
    intentCount: lastCompilation.intents.length,
    packs: packResults,
    baselineClean: !baselineResult.hasErrors,
  };
}

function printReport(results: BlueprintAuditResult[]): void {
  console.log('='.repeat(72));
  console.log('  FedRAMP Compliance Audit Report');
  console.log('  Generated:', new Date().toISOString());
  console.log('='.repeat(72));

  let allBaselineClean = true;

  for (const result of results) {
    console.log();
    console.log(`Blueprint: ${result.blueprintPath}`);
    console.log(`  Service: ${result.service}`);
    console.log(
      `  Nodes: ${result.nodeCount}  Edges: ${result.edgeCount}  Intents: ${result.intentCount}`,
    );
    console.log();

    for (const pack of result.packs) {
      const status = pack.compliant ? 'COMPLIANT' : 'NON-COMPLIANT';
      const marker = pack.compliant ? '[PASS]' : '[FAIL]';
      console.log(
        `  ${marker} ${pack.policyPack}: ${status} (${pack.violations.length} violations)`,
      );

      if (pack.violations.length > 0) {
        const bySeverity = { error: 0, warning: 0, info: 0 };
        for (const v of pack.violations) {
          bySeverity[v.severity]++;
        }
        console.log(
          `    Breakdown: ${bySeverity.error} errors, ${bySeverity.warning} warnings, ${bySeverity.info} info`,
        );

        for (const v of pack.violations) {
          const icon =
            v.severity === 'error' ? 'X' : v.severity === 'warning' ? '!' : '.';
          console.log(
            `    [${icon}] ${v.severity.padEnd(7)} ${v.ruleId} → ${v.targetId}`,
          );
        }
      }
    }

    if (!result.baselineClean) {
      allBaselineClean = false;
      console.log();
      console.log(
        `  ** BASELINE HAS ERRORS — this blueprint needs remediation **`,
      );
    }
  }

  console.log();
  console.log('='.repeat(72));
  console.log(`  Summary: ${results.length} blueprint(s) audited`);
  console.log(
    `  Baseline clean: ${allBaselineClean ? 'YES' : 'NO — action required'}`,
  );
  console.log('='.repeat(72));

  // JSON output for CI
  const jsonReport = {
    timestamp: new Date().toISOString(),
    blueprints: results.map((r) => ({
      path: r.blueprintPath,
      service: r.service,
      nodes: r.nodeCount,
      edges: r.edgeCount,
      intents: r.intentCount,
      baselineClean: r.baselineClean,
      packs: r.packs.map((p) => ({
        name: p.policyPack,
        compliant: p.compliant,
        violationCount: p.violations.length,
        violations: p.violations,
      })),
    })),
    allBaselineClean,
  };

  const reportPath = path.join(process.cwd(), 'audit-fedramp-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(jsonReport, null, 2));
  console.log(`\n  JSON report written to: ${reportPath}`);

  if (!allBaselineClean) {
    process.exit(1);
  }
}

// Main
const args = process.argv.slice(2);
let blueprintPaths: string[];

if (args.length > 0) {
  blueprintPaths = args.map((a) => path.resolve(a));
} else {
  // Find all blueprint YAML files
  const blueprintDir = path.join(process.cwd(), 'blueprints');
  blueprintPaths = [];
  for (const category of fs.readdirSync(blueprintDir)) {
    const catDir = path.join(blueprintDir, category);
    if (!fs.statSync(catDir).isDirectory()) continue;
    for (const file of fs.readdirSync(catDir)) {
      if (file.endsWith('.yaml') || file.endsWith('.yml')) {
        blueprintPaths.push(path.join(catDir, file));
      }
    }
  }
}

if (blueprintPaths.length === 0) {
  console.error('No blueprint files found.');
  process.exit(1);
}

const results = blueprintPaths.map(auditBlueprint);
printReport(results);
