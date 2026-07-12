# AGENTS.md

Canonical entry point for AI agents working with Shinobi — as a **consumer**
(integrating the library/CLI into a platform or authoring manifests) or as a
**contributor** (developing this repository).

## For Consumer Agents

### Structured interfaces (use these, not text parsing)

- Every CLI command accepts `--json` (structured result) and
  `--harmony-envelope` (versioned `ToolResponseEnvelope` with `traceId`,
  `toolVersion`, `contractVersion`). Never parse the human-readable output.
- Errors are `{ path, message }` objects with stable paths.
- JSON Schemas live in [`schemas/`](schemas/) — validate manifests before
  submitting them:
  - `schemas/manifest.schema.json` — the service manifest format
  - `schemas/validate-result.schema.json` — `shinobi validate --json` output
  - `schemas/tool-response-envelope.schema.json` — envelope format
- The MCP-style tool wrapper (plan/apply/validate/read as tool calls with
  async operation handles) is exported from `@shinobi/cli` — see
  `docs/standards/agent-tool-protocol.md` and `docs/integrations/harmony.md`.

### Authoring manifests

- Format: `docs/user/manifest-authoring-guide.md`; copy-ready patterns:
  `docs/cookbook/manifest-patterns.md`, `examples/*.yaml`, `blueprints/`.
- Component coverage and confidence tiers: `docs/user/support-matrix.md`.
  Only the deploy-confident tier is hardened against real AWS.
- Supported edges: `bindsTo` (component→platform), `triggers`
  (platform→component), `dependsOn` (ordering only). Any other edge shape
  produces a validation warning — check `validate --json` diagnostics.
- Policy packs must be selected explicitly (`Baseline`, `FedRAMP-Moderate`,
  `FedRAMP-High`); rule exceptions are declared in the manifest with an
  expiry (`docs/standards/exception-model.md`).

### Embedding the library

`docs/user/integration-guide.md` is the authoritative embed reference:
public packages, kernel-level pipeline, and extension points (custom binders,
policy evaluators, node lowerers, adapters).

## For Contributor Agents

- `CLAUDE.md` — architecture, package dependency graph, invariants, kernel
  laws, commands. Read it first; the invariants (determinism, no provider
  SDKs outside `packages/adapters/`, structured outputs only) are enforced
  by CI and non-negotiable.
- Skills: `.claude/skills/` is the canonical skill root (mirrored to other
  agent tools — do not edit mirrors directly; run `node scripts/sync-skills.mjs`).
- Roles and skill bundles: `roles.md`.
- Local gate sequence before any push: see `CONTRIBUTING.md` (format, build,
  test, lint, conformance, smoke, blueprints, roadmap, dashboard, docs).
- Work queues: `docs/product-management/backlog.md` (EE-\*/MCA-\* epics) and
  `docs/operations/current-roadmap.md`.

## Repository Map (agent-oriented)

| Path                | What it is                                                      |
| ------------------- | --------------------------------------------------------------- |
| `packages/`         | The 9 published `@shinobi/*` packages (source of truth is code) |
| `schemas/`          | Published JSON Schemas for machine validation                   |
| `examples/`         | Runnable manifests + programmatic embedding example             |
| `blueprints/`       | CI-validated reference architectures                            |
| `docs/standards/`   | 13 normative standards (contracts, schemas, protocols)          |
| `docs/user/`        | Consumer docs (CLI, manifests, integration, support matrix)     |
| `docs/operations/`  | Internal ops evidence and runbooks (not consumer docs)          |
| `docs/conformance/` | Gate registry mapping standards → mechanical enforcement        |
| `extraction/`       | V2→V3 design history (context, not current contracts)           |
| `test-cases/`       | Test classification index (docs, not runnable tests)            |
