#!/usr/bin/env npx tsx
/**
 * Blueprint Golden Test Generator
 *
 * Reads a blueprint YAML manifest and generates a conformance golden test
 * following the proven pattern from existing tests.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/generate-golden-test.ts \
 *     --blueprint blueprints/compute/eks-managed-cluster.yaml \
 *     --bp-id BP-005
 *
 * Output: Prints the full test file to stdout.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parse as parseYaml } from "yaml";

interface ManifestComponent {
  id: string;
  type: string;
  platform: string;
  config?: Record<string, unknown>;
}

interface ManifestBinding {
  source: string;
  target: string;
  type: string;
  config?: Record<string, unknown>;
}

interface ServiceManifest {
  service: string;
  components: ManifestComponent[];
  bindings: ManifestBinding[];
  policyPack?: string;
}

// --- CLI argument parsing ---
const args = process.argv.slice(2);
const blueprintIdx = args.indexOf("--blueprint");
const bpIdIdx = args.indexOf("--bp-id");

if (blueprintIdx === -1 || bpIdIdx === -1) {
  console.error(
    "Usage: npx tsx --tsconfig tsconfig.scripts.json scripts/generate-golden-test.ts --blueprint <path> --bp-id <id>",
  );
  process.exit(1);
}

const blueprintPath = args[blueprintIdx + 1];
const bpId = args[bpIdIdx + 1];

if (!blueprintPath || !bpId) {
  console.error("Both --blueprint and --bp-id are required");
  process.exit(1);
}

const resolvedPath = path.resolve(blueprintPath);
if (!fs.existsSync(resolvedPath)) {
  console.error(`Blueprint not found: ${resolvedPath}`);
  process.exit(1);
}

// --- Parse YAML ---
const raw = fs.readFileSync(resolvedPath, "utf8");
const manifest = parseYaml(raw) as ServiceManifest;

// --- Derive metadata ---
const serviceName = manifest.service;
const components = manifest.components;
const bindings = manifest.bindings ?? [];
const nodeCount = components.length;
const edgeCount = bindings.length;

// Determine if platform-only (no component-type nodes)
const hasComponents = components.some((c) => c.type === "component");
const componentToplatformEdges = bindings.filter((b) => {
  const sourceComp = components.find((c) => c.id === b.source);
  const targetComp = components.find((c) => c.id === b.target);
  return sourceComp?.type === "component" && targetComp?.type === "platform";
});

// Intent count heuristic
let intentCountEstimate: number;
let intentComment: string;
if (!hasComponents) {
  intentCountEstimate = 0;
  intentComment = "platform-to-platform edges do not produce intents";
} else {
  // triggers edges produce ~3 intents (iam + 2 config), bindsTo edges produce ~3 (iam + network + config)
  const triggersEdges = bindings.filter((b) => {
    const sourceComp = components.find((c) => c.id === b.source);
    return (
      b.type === "triggers" ||
      (sourceComp?.type !== "component" && b.type === "triggers")
    );
  }).length;
  const bindsToEdges = componentToplatformEdges.filter(
    (b) => b.type === "bindsTo",
  ).length;
  intentCountEstimate = triggersEdges * 3 + bindsToEdges * 3;
  intentComment = `TODO: verify intent count (~${intentCountEstimate} estimated: ~3 per component→platform edge)`;
}

// --- Derive test file name ---
const fileBaseName = path.basename(blueprintPath, path.extname(blueprintPath));

// --- Extract YAML comment header ---
const yamlLines = raw.split("\n");
const headerComments: string[] = [];
for (const line of yamlLines) {
  if (line.startsWith("#")) {
    headerComments.push(line.replace(/^#\s?/, "").trim());
  } else if (line.trim() === "") {
    continue;
  } else {
    break;
  }
}

// --- Helper: format a value as TypeScript literal ---
function formatValue(value: unknown, indent: number): string {
  const pad = " ".repeat(indent);
  if (value === null || value === undefined) return "undefined";
  if (typeof value === "string") return `'${value.replace(/'/g, "\\'")}'`;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    if (value.every((v) => typeof v === "string")) {
      return `[${value.map((v) => `'${v}'`).join(", ")}]`;
    }
    const items = value
      .map((v) => `${pad}  ${formatValue(v, indent + 2)}`)
      .join(",\n");
    return `[\n${items},\n${pad}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return "{}";
    const lines = entries.map(
      ([k, v]) => `${pad}  ${k}: ${formatValue(v, indent + 2)}`,
    );
    return `{\n${lines.join(",\n")},\n${pad}}`;
  }
  return String(value);
}

// --- Helper: convert component ID to camelCase variable name ---
function toVarName(id: string): string {
  return id.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

// --- Helper: convert binding to camelCase variable name ---
function toEdgeVarName(binding: ManifestBinding): string {
  const sourceName = toVarName(binding.source);
  const verb = binding.type === "triggers" ? "Triggers" : "Binds";
  const targetName = toVarName(binding.target);
  return `${sourceName}${verb}${targetName.charAt(0).toUpperCase() + targetName.slice(1)}`;
}

// --- Generate node creation code ---
function generateNodeCode(comp: ManifestComponent): string {
  const varName = toVarName(comp.id);
  const nodeId = `${comp.type}:${comp.id}`;

  const props: Record<string, unknown> = { platform: comp.platform };
  if (comp.config) {
    Object.assign(props, comp.config);
  }

  const propsFormatted = formatValue(props, 6);

  return `  const ${varName} = createTestNode({
    id: '${nodeId}',
    type: '${comp.type}',
    metadata: {
      properties: ${propsFormatted},
    },
  });`;
}

// --- Generate edge creation code ---
function generateEdgeCode(binding: ManifestBinding): string {
  const varName = toEdgeVarName(binding);
  const sourceComp = components.find((c) => c.id === binding.source)!;
  const targetComp = components.find((c) => c.id === binding.target)!;
  const sourceId = `${sourceComp.type}:${sourceComp.id}`;
  const targetId = `${targetComp.type}:${targetComp.id}`;
  const edgeId = `edge:${binding.type}:${sourceId}:${targetId}`;

  const configFormatted = binding.config
    ? formatValue(binding.config, 8)
    : "{}";

  return `  const ${varName} = createTestEdge({
    id: '${edgeId}',
    type: '${binding.type}',
    source: ${toVarName(sourceComp.id)}.id,
    target: ${toVarName(targetComp.id)}.id,
    metadata: {
      bindingConfig: ${configFormatted},
    },
  });`;
}

// --- Build architecture description ---
const architectureLines = headerComments.filter((l) => l.length > 0);

// --- Generate node IDs list for assertions ---
const nodeIds = components.map((c) => `${c.type}:${c.id}`);

// --- Build the test file ---
const output = `import { describe, it, expect } from 'vitest';
import { createTestNode, createTestEdge } from '@shinobi/ir';
import type { GraphMutation } from '@shinobi/ir';
import { ComponentPlatformBinder, TriggersBinder, BinderRegistry } from '@shinobi/binder';
import { BaselinePolicyEvaluator } from '@shinobi/policy';
import { runGoldenCase } from '../golden-runner';

/**
 * Golden test for Blueprint ${bpId}: ${serviceName}
 *
${architectureLines.map((l) => ` * ${l}`).join("\n")}
 *
 * ${!hasComponents ? "This is a platform-only blueprint — all nodes are platform type.\n * Platform-to-platform bindsTo edges produce zero intents because\n * ComponentPlatformBinder only fires for component→platform edges." : "This blueprint has component→platform edges that produce intents."}
 *
 * Gates: determinism (G-001), compilation (G-002), policy evaluation
 */

function setupBlueprint(): ReadonlyArray<GraphMutation> {
${components.map(generateNodeCode).join("\n\n")}

${bindings.map(generateEdgeCode).join("\n\n")}

  return [
${components.map((c) => `    { type: 'addNode', node: ${toVarName(c.id)} },`).join("\n")}
${bindings.map((b) => `    { type: 'addEdge', edge: ${toEdgeVarName(b)} },`).join("\n")}
  ];
}

function makeBinders() {
  const registry = new BinderRegistry();
  registry.register(new ComponentPlatformBinder());
  registry.register(new TriggersBinder());
  return registry.getBinders();
}

describe('Golden: Blueprint ${bpId} — ${serviceName}', () => {
  const evaluator = new BaselinePolicyEvaluator();

  it('compiles successfully', () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: 'Baseline' },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    expect(compilation.validation.valid).toBe(true);
  });

  it('contains all ${nodeCount} nodes', () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: 'Baseline' },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    expect(compilation.snapshot.nodes).toHaveLength(${nodeCount});
    const ids = compilation.snapshot.nodes.map((n) => n.id);
${nodeIds.map((id) => `    expect(ids).toContain('${id}');`).join("\n")}
  });

  it('contains ${edgeCount === 1 ? "1 edge" : `all ${edgeCount} edges`}', () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: 'Baseline' },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    expect(compilation.snapshot.edges).toHaveLength(${edgeCount});
  });

  it('emits ${intentCountEstimate === 0 ? "zero" : intentCountEstimate} intents (${intentComment})', () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: 'Baseline' },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    expect(compilation.intents).toHaveLength(${intentCountEstimate});
  });

  it('determinism: identical output across two runs', () => {
    const opts = {
      setup: setupBlueprint,
      config: { policyPack: 'Baseline' },
      binders: makeBinders(),
      evaluators: [evaluator],
    };

    const r1 = runGoldenCase(opts);
    const r2 = runGoldenCase(opts);
    expect(r1.serialized).toBe(r2.serialized);
  });

  describe('policy evaluation across packs', () => {
    it.each(['Baseline', 'FedRAMP-Moderate', 'FedRAMP-High'] as const)(
      'evaluates with pack %s without throwing',
      (pack) => {
        const { compilation } = runGoldenCase({
          setup: setupBlueprint,
          config: { policyPack: pack },
          binders: makeBinders(),
          evaluators: [evaluator],
        });

        expect(compilation.policy?.violations).toBeDefined();
      },
    );

    // TODO: Add blueprint-specific policy rule assertions here.
    // Examples:
    //   - Verify specific rules do NOT fire for well-configured resources
    //   - Verify FedRAMP-High escalates specific rules to error severity
  });
});
`;

process.stdout.write(output);
