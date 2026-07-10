// Bundles the Atlas data into a single window global so the site opens from file://
// with no server. Re-run after editing any site/data/*.json: `node site/build-data.mjs`
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const readText = (p) =>
  existsSync(join(root, p)) ? readFileSync(join(root, p), 'utf8') : null;

const capabilities = read('site/data/capabilities.json');
const policies = read('site/data/policies.json');
const blueprints = read('site/data/blueprints.json');

// Architecture data: prefer the live knowledge graph; fall back to the committed
// snapshot so the site rebuilds on a fresh clone without the (large) graph file.
// Refresh the snapshot any time after re-running /understand: `node site/build-data.mjs`.
const arch = (() => {
  const kgPath = '.understand-anything/knowledge-graph.json';
  if (existsSync(join(root, kgPath))) {
    const kg = read(kgPath);
    const order = [
      'layer:contracts-ir',
      'layer:validation',
      'layer:kernel',
      'layer:binder',
      'layer:policy',
      'layer:aws-adapter',
      'layer:cli',
      'layer:conformance-tooling',
      'layer:blueprints',
      'layer:build-config-docs',
    ];
    const layers = kg.layers
      .slice()
      .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
      .map((l) => ({
        id: l.id,
        name: l.name,
        description: l.description,
        nodeCount: l.nodeIds.length,
      }));
    const nodeTypeCounts = kg.nodes.reduce((a, n) => {
      a[n.type] = (a[n.type] || 0) + 1;
      return a;
    }, {});
    const snap = {
      project: { name: kg.project?.name, description: kg.project?.description },
      layers,
      nodeTypeCounts,
      graphNodes: kg.nodes.length,
      graphEdges: kg.edges.length,
    };
    writeFileSync(
      join(root, 'site/data/architecture.json'),
      JSON.stringify(snap, null, 2) + '\n',
    );
    return snap;
  }
  return read('site/data/architecture.json');
})();
const kg = {
  project: arch.project,
  layers: arch.layers.map((l) => ({ ...l, nodeIds: { length: l.nodeCount } })),
  nodes: { length: arch.graphNodes },
  edges: { length: arch.graphEdges },
};

// ---- Cross-link: which policy rules govern which capabilities ----
function capServiceKey(id) {
  const map = [
    ['aws-eks', 'eks'],
    ['aws-rds', 'rds'],
    ['aws-ecs', 'ecs'],
    ['aws-ecr', 'ecr'],
    ['aws-msk', 'msk'],
    ['aws-cloudfront', 'cloudfront'],
    ['aws-network-firewall', 'network-firewall'],
    ['aws-nat-gateway', 'nat-gateway'],
    ['aws-stepfunctions', 'stepfunctions'],
    ['aws-wafv2', 'waf'],
    ['aws-secretsmanager', 'secrets'],
    ['aws-budgets', 'budget'],
    ['aws-apigateway', 'apigateway'],
    ['aws-sagemaker', 'sagemaker'],
    ['aws-opensearch', 'opensearch'],
    ['aws-elasticache', 'elasticache'],
    ['aws-cloudtrail', 'cloudtrail'],
    ['aws-guardduty', 'guardduty'],
    ['aws-route53', 'route53'],
    ['aws-eventbridge', 'eventbridge'],
    ['aws-kinesis-firehose', 'firehose'],
    ['aws-glue', 'glue'],
    ['aws-athena', 'athena'],
    ['aws-bedrock', 'bedrock'],
    ['aws-kms', 'kms'],
    ['aws-alb', 'alb'],
  ];
  for (const [pre, key] of map)
    if (id === pre || id.startsWith(pre)) return key;
  if (['iam', 'network', 'telemetry', 'config'].includes(id)) return id;
  return id.replace(/^aws-/, '').split('-')[0];
}
const keyToCaps = {};
capabilities.forEach((c) => {
  const k = capServiceKey(c.id);
  (keyToCaps[k] = keyToCaps[k] || []).push(c.id);
});
function policyTargets(id) {
  if (id.startsWith('iam-')) return keyToCaps['iam'] || [];
  if (id.startsWith('telemetry-')) return keyToCaps['telemetry'] || [];
  if (id.startsWith('network-') && !id.startsWith('network-firewall'))
    return keyToCaps['network'] || [];
  const alias = id.startsWith('sfn-') ? 'stepfunctions-' + id.slice(4) : id;
  const keys = Object.keys(keyToCaps).sort((a, b) => b.length - a.length);
  for (const k of keys)
    if (alias === k || alias.startsWith(k + '-')) return keyToCaps[k];
  return [];
}
const capPolicies = {};
policies.forEach((p) => {
  const targets = policyTargets(p.id);
  p.appliesTo = targets;
  targets.forEach((cid) => {
    (capPolicies[cid] = capPolicies[cid] || []).push(p.id);
  });
});
capabilities.forEach((c) => {
  c.policyIds = capPolicies[c.id] || [];
});

// ---- Embed the real manifest YAML for implemented blueprints ----
blueprints.forEach((b) => {
  if (b.file) b.manifest = readText(b.file);
});

// ---- The compilation pipeline (the heart of the platform) ----
const pipeline = [
  {
    id: 'manifest',
    name: 'Author the Manifest',
    short: 'Manifest',
    package: 'examples / blueprints',
    role: 'You',
    summary:
      'A developer declares the system they want as a YAML service manifest — components and the relationships between them. No provider SDKs, no imperative wiring.',
    detail:
      'The manifest is the single source of truth. You describe components by capability and connect them with bindings (e.g. "this function reads from that queue"). Shinobi takes it from there — everything downstream is derived, deterministic, and auditable.',
    inputs: ['Service manifest (YAML)'],
    outputs: ['A validated authoring intent'],
    files: ['examples/lambda-sqs.yaml', 'blueprints/_template.yaml'],
    invariants: [
      'Backend-neutral authoring — no provider handles in the manifest',
    ],
    accent: 'sky',
  },
  {
    id: 'parse',
    name: 'Parse & Build the Graph',
    short: 'Graph',
    package: '@shinobi/cli',
    role: 'Manifest Parser',
    summary:
      'The parser turns the manifest into a typed object graph: nodes for components, edges for bindings — each with a stable, content-derived ID.',
    detail:
      'YAML becomes a ServiceManifest, then a list of graph mutations. IDs are computed from canonical paths and semantic hashes — never random, never timestamped — so the same manifest always yields the same graph.',
    inputs: ['Service manifest (YAML)'],
    outputs: ['Graph mutations → nodes & edges'],
    files: [
      'packages/cli/src/manifest/parser.ts',
      'packages/cli/src/manifest/graph-builder.ts',
    ],
    invariants: [
      'Stable IDs (no UUIDs / timestamps)',
      'Cross-references validated at parse time',
    ],
    accent: 'cyan',
  },
  {
    id: 'kernel',
    name: 'Compile in the Kernel',
    short: 'Kernel',
    package: '@shinobi/kernel',
    role: 'Graph Engine',
    summary:
      'The kernel applies mutations, enforces canonical ordering, and produces a frozen, byte-stable snapshot of the whole system.',
    detail:
      'This is the deterministic core. Nodes, edges, and artifacts are sorted into a canonical order and the result is frozen. Identical inputs produce byte-identical outputs — the foundation everything else trusts.',
    inputs: ['Graph mutations'],
    outputs: ['Frozen graph snapshot'],
    files: [
      'packages/kernel/src/compilation-pipeline.ts',
      'packages/ir/src/canonicalization.ts',
    ],
    invariants: [
      'Determinism (KL-001)',
      'Canonical ordering',
      'Idempotent mutations',
    ],
    accent: 'violet',
  },
  {
    id: 'binder',
    name: 'Bind Edges → Intents',
    short: 'Binders',
    package: '@shinobi/binder',
    role: 'Edge Compiler',
    summary:
      'Each relationship is compiled into backend-neutral intents — abstract statements of desired effect: IAM, network, config, telemetry.',
    detail:
      'A binding like "function reads queue" becomes an IAM intent (least-privilege read actions) plus config intents (the queue URL) — all expressed in provider-free terms. Binders never know about AWS, Azure, or GCP.',
    inputs: ['Frozen graph snapshot'],
    outputs: ['Backend-neutral intents'],
    files: [
      'packages/binder/src/binders/component-platform-binder.ts',
      'packages/binder/src/intent-factories.ts',
    ],
    invariants: [
      'Least-privilege by construction (KL-005)',
      'No provider branching',
    ],
    accent: 'indigo',
  },
  {
    id: 'policy',
    name: 'Evaluate Compliance',
    short: 'Policy',
    package: '@shinobi/policy',
    role: 'Compliance Engine',
    summary:
      'The selected policy pack evaluates the graph and intents, emitting structured violations before anything is deployed.',
    detail:
      'Rules are data, not code branches. The same rule set escalates in severity across packs (Baseline → FedRAMP-Moderate → FedRAMP-High). Compliance is assessed up-front, so you fail fast with explainable diagnostics.',
    inputs: ['Snapshot + intents', 'Policy pack selection'],
    outputs: ['Structured violations (by severity)'],
    files: [
      'packages/policy/src/evaluators/baseline-policy-evaluator.ts',
      'packages/policy/src/rules.ts',
    ],
    invariants: [
      'Pack-driven, explicit selection (KL-008)',
      'Rules as data — no pack branching',
    ],
    accent: 'amber',
  },
  {
    id: 'adapter',
    name: 'Lower to Resources',
    short: 'Adapter',
    package: '@shinobi/adapter-aws',
    role: 'Provider Adapter',
    summary:
      'The adapter lowers abstract nodes and intents into concrete, provider-native resources and a topologically ordered resource plan.',
    detail:
      'This is the only layer that knows about a cloud provider. Lowerers translate each capability (e.g. "Serverless Function") into provider resources (e.g. a Lambda function, an execution role, a log group). Today: AWS via Pulumi. Tomorrow: Azure & GCP behind the same contract.',
    inputs: ['Nodes + intents'],
    outputs: ['Resource plan (LoweredResource[])'],
    files: [
      'packages/adapters/aws/src/adapter.ts',
      'packages/adapters/aws/src/program-generator.ts',
    ],
    invariants: [
      'No backend handles above this layer (KL-004)',
      'Deterministic plan ordering',
    ],
    accent: 'orange',
  },
  {
    id: 'deploy',
    name: 'Plan & Deploy',
    short: 'Deploy',
    package: 'Pulumi Automation',
    role: 'Deployer',
    summary:
      'The resource plan becomes a Pulumi program. Preview by default; deploy on explicit approval. Structured results all the way out.',
    detail:
      'Shinobi drives the Pulumi Automation API to preview or apply. Safe-by-default: the CLI previews unless you pass --no-dry-run. Errors are classified (credentials, conflict, timeout) with retry guidance.',
    inputs: ['Resource plan'],
    outputs: ['Preview diff / deployed stack'],
    files: [
      'packages/adapters/aws/src/deployer.ts',
      'packages/cli/src/commands/up.ts',
    ],
    invariants: [
      'Safe-by-default (preview unless approved)',
      'Structured, classified outcomes',
    ],
    accent: 'emerald',
  },
];

// ---- Architecture layers (from the knowledge graph / committed snapshot) ----
const layers = arch.layers;
const nodeTypeCounts = arch.nodeTypeCounts;

// ---- Glossary (knowledge transfer) ----
const glossary = [
  {
    term: 'Manifest',
    def: 'A YAML declaration of the components and bindings that make up a service — the single source of truth Shinobi compiles.',
  },
  {
    term: 'Node',
    def: 'A typed object in the graph representing a component or platform concept (e.g. a Serverless Function).',
  },
  {
    term: 'Edge',
    def: 'A typed relationship between nodes — a binding, trigger, or dependency.',
  },
  {
    term: 'Intent',
    def: 'A backend-neutral statement of desired effect (IAM, network, config, telemetry). The portable currency between binders and adapters.',
  },
  {
    term: 'Binder',
    def: 'A deterministic "edge compiler" that maps an edge + context into intents.',
  },
  {
    term: 'Lowerer',
    def: 'Adapter code that translates one capability or intent into concrete provider resources.',
  },
  {
    term: 'Policy Pack',
    def: 'A named rule set (Baseline, FedRAMP-Moderate, FedRAMP-High). Severity escalates across packs; the rules themselves do not change.',
  },
  {
    term: 'Blueprint',
    def: 'A ready-made manifest pattern that stands up a complete, opinionated architecture.',
  },
  {
    term: 'Determinism',
    def: 'Identical inputs always produce byte-identical outputs — the property that makes Shinobi auditable and testable.',
  },
];

// ---- Headline stats ----
const stats = {
  capabilities: capabilities.filter((c) => c.kind !== 'intent').length,
  intents: capabilities.filter((c) => c.kind === 'intent').length,
  policyRules: policies.length,
  policyPacks: 3,
  blueprintsTotal: blueprints.length,
  blueprintsImplemented: blueprints.filter((b) => b.status === 'Implemented')
    .length,
  layers: layers.length,
  graphNodes: kg.nodes.length,
  graphEdges: kg.edges.length,
};

const data = {
  meta: {
    name: 'Shinobi Atlas',
    project: kg.project?.name || 'Shinobi V3',
    tagline:
      'A deterministic infrastructure kernel — from one manifest to compliant, deployable cloud.',
    description: kg.project?.description || '',
    generatedFrom:
      'Generated from the Shinobi source tree — capabilities, policies, blueprints, and the knowledge graph.',
  },
  stats,
  pipeline,
  capabilities,
  policies,
  blueprints,
  layers,
  nodeTypeCounts,
  glossary,
};

const out = `// AUTO-GENERATED by site/build-data.mjs — do not edit by hand.\nwindow.SHINOBI_ATLAS = ${JSON.stringify(data, null, 2)};\n`;
writeFileSync(join(root, 'site/data.js'), out);
console.log('Wrote site/data.js');
console.log(
  `  capabilities: ${stats.capabilities} (+${stats.intents} intents)`,
);
console.log(
  `  policies: ${stats.policyRules}  blueprints: ${stats.blueprintsImplemented}/${stats.blueprintsTotal}  layers: ${stats.layers}`,
);
