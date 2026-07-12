# Integration Guide: Embedding Shinobi in a Platform

This guide is for platform teams consuming Shinobi as a **library** rather
than (or in addition to) the `shinobi` CLI. It covers the public packages,
the embed sequence, extension points, and the API stability policy.

## Public Packages

| Package                | Install when you need                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `@shinobi/cli`         | The highest-level programmatic API: `parseManifest`, `validate`, `plan`, `up`, envelopes, and the `shinobi` binary |
| `@shinobi/kernel`      | The graph engine: `Kernel`, mutation API, compile, config resolution, facade                                       |
| `@shinobi/contracts`   | Shared types: intents, capabilities, adapter interface (zero dependencies)                                         |
| `@shinobi/ir`          | Graph model: `Node`, `Edge`, provenance, canonical ordering                                                        |
| `@shinobi/binder`      | Binder base classes and registry — needed to author custom binders                                                 |
| `@shinobi/policy`      | Policy packs, rule catalog, `BaselinePolicyEvaluator`                                                              |
| `@shinobi/validation`  | Validation pipeline (usually consumed indirectly via the kernel)                                                   |
| `@shinobi/adapter-aws` | AWS lowering, plan generation, Pulumi deployment                                                                   |
| `@shinobi/conformance` | Golden-case/triad test harness — for teams extending Shinobi                                                       |

All packages are **ESM-only** except `@shinobi/cli` (CommonJS, because it
bundles the executable). Node.js 20+ is required. `@shinobi/adapter-aws`
declares `@pulumi/pulumi` and `@pulumi/aws` as peer dependencies — your
platform provides its own Pulumi version within the documented ranges
(`^3.0.0` / `^6.0.0`).

## Quick Embed (High-Level API)

The fastest integration uses the command functions from `@shinobi/cli` — the
same code paths the binary runs, returning structured results instead of
printing:

```ts
import { validate, plan, up } from '@shinobi/cli';

const v = validate({ manifestPath: 'service.yaml', policyPack: 'Baseline' });
if (!v.success) {
  // v.errors is ReadonlyArray<{ path: string; message: string }>
  throw new Error(v.errors.map((e) => `${e.path}: ${e.message}`).join('\n'));
}

const p = plan({ manifestPath: 'service.yaml', region: 'us-east-1' });
// p.plan is a deterministic ResourcePlan: resources, dependencies, outputs

const preview = await up({
  manifestPath: 'service.yaml',
  region: 'us-east-1',
  dryRun: true, // safe default; set false to deploy
});
```

Every result is a structured JSON-serializable object (never a formatted
string), so the same values can be logged, stored, or returned from an API.

## Full Pipeline (Kernel-Level API)

When you need control over each stage — custom binders, your own policy
evaluator, a different adapter — compose the pipeline directly:

```ts
import { parseManifest, manifestToMutations } from '@shinobi/cli';
import { Kernel } from '@shinobi/kernel';
import {
  BinderRegistry,
  ComponentPlatformBinder,
  TriggersBinder,
} from '@shinobi/binder';
import { BaselinePolicyEvaluator } from '@shinobi/policy';
import { lower, generatePlan } from '@shinobi/adapter-aws';

// 1. Parse the manifest into graph mutations
const parsed = parseManifest(yamlContent);
if (!parsed.ok) throw new Error(parsed.errors[0]?.message);
const mutations = manifestToMutations(parsed.manifest);

// 2. Assemble the kernel with your binder/evaluator set
const registry = new BinderRegistry();
registry.register(new ComponentPlatformBinder());
registry.register(new TriggersBinder());

const kernel = new Kernel({
  binders: registry.getBinders(),
  evaluators: [new BaselinePolicyEvaluator()],
  config: { policyPack: 'FedRAMP-Moderate' },
});

// 3. Apply mutations and compile
const applied = kernel.applyMutation(mutations);
if (!applied.success) throw new Error('graph mutation failed');
const compilation = kernel.compile();
// compilation.validation, compilation.policy, compilation.intents,
// compilation.snapshot — all deterministic and JSON-serializable

// 4. Lower to provider resources and generate the plan
const lowered = lower({
  intents: compilation.intents,
  snapshot: compilation.snapshot,
  adapterConfig: { region: 'us-east-1', serviceName: parsed.manifest.service },
});
const resourcePlan = generatePlan(lowered);
```

A runnable version of this lives in `../../examples/programmatic/`.

## Extension Points

### Custom binders (new edge semantics)

Implement `IBinder` (from `@shinobi/kernel`) or extend the patterns in
`@shinobi/binder`, then register it. A binder declares the edge shapes it
supports and deterministically emits intents:

```ts
registry.register(new MyQueuePolicyBinder()); // conflicts are rejected
```

Edges that no registered binder supports are reported as validation
warnings — nothing silently compiles to nothing.

### Custom policy evaluators

Implement `IPolicyEvaluator` (from `@shinobi/kernel`) and pass it in the
`Kernel` constructor's `evaluators` array. Policy packs are data: rules with
IDs and per-pack severity mappings, never code branches per pack.

### Custom node lowerers (new AWS resource types)

```ts
import { createDefaultNodeLowererRegistry } from '@shinobi/adapter-aws';

const lowerers = createDefaultNodeLowererRegistry();
lowerers.register(new MyPlatformLowerer(), { overwrite: false });
```

### Custom adapters (other providers)

Implement the backend-neutral `Adapter` interface from `@shinobi/contracts`
and pass it to `createCli({ adapters: [...] })` or call it directly in your
own pipeline. The kernel, binders, and policy engine never see provider
types — an adapter's only inputs are compiled intents and the graph snapshot.

### Custom CLI

`createCli` from `@shinobi/cli` builds the commander program; you can wrap it
in your own binary with your extensions registered, keeping `validate`,
`plan`, `up`, and `destroy` behavior consistent with upstream.

## Structured Output Contracts

- Every command supports `--json` (plain structured result) and
  `--harmony-envelope` (versioned `ToolResponseEnvelope` with trace IDs).
- Error objects are `{ path, message }` with stable paths (KL-002/KL-006).
- JSON Schemas for the manifest format and CLI results are published in
  `../../schemas/` and shipped with `@shinobi/contracts`.

## Versioning and Stability Policy

- All packages are currently **0.x**: minor versions may contain breaking
  changes; patch versions do not. Pin exact versions or a `~` range.
- The `@shinobi/*` packages are versioned independently via changesets, but a
  given release train is tested together — prefer installing matching latest
  versions rather than mixing old and new.
- **Stable surface**: everything exported from a package's root entry point
  (`import ... from '@shinobi/x'`). Deep imports (`@shinobi/x/dist/...`) are
  internal and may break without notice.
- Contract changes follow `docs/standards/` (versioned interfaces, additive
  evolution); breaking changes are called out in each package's CHANGELOG.

## Operational Notes for Embedders

- Deployment (`up`/`destroy`) shells out to the Pulumi Automation API; the
  Pulumi CLI must be on `PATH` and AWS credentials in the environment.
- State backend and secrets provider are configurable per invocation
  (`--backend-url`, `--secrets-provider`, or the corresponding options in
  `UpOptions`); by default Pulumi's ambient configuration is used.
- Stack names are `{service}-{region}` or `{service}-{environment}-{region}`
  when an environment is set — namespace environments to avoid collisions.
