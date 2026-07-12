# Library Readiness Audit — 2026-07-12

Framework: `library-readiness-framework.md` (first execution)
Scope: readiness of Shinobi V3 for **public distribution (npm)** and
**standalone integration into a platform** — programmatic, CLI, and agent
consumption surfaces.

## Executive Summary

> **Remediation update (2026-07-12):** all P0 blockers below were fixed the
> same day — see the Remediation Log at the end of this report. Post-fix
> verdict: **Ready with Caveats** (zero Blockers; High findings remain and
> are tracked in the P1/P2 backlog).

**Verdict at audit time: Not Ready** for a public `v0.x` publish — but the
distance is short and well-bounded. The blockers are almost entirely **distribution
mechanics and community scaffolding**, not engineering quality: there is no
LICENSE file, changesets is configured `restricted`, one package on the public
type chain ships no declarations, the CLI manifest would publish broken, and
no release automation exists. None of these are architecturally hard.

The underlying engineering is strong: a deterministic kernel→binder→policy→
adapter pipeline with ~1,778 tests across 121 spec files, mechanically
enforced module boundaries, CI-validated blueprints, structured JSON/envelope
output on every command, and an unusually candid internal audit culture
(`2026-02-15-reality-audit.md`).

The **capability baseline** (dimension H) tells a two-tier story a consuming
platform team must understand: the serverless MVP families
(Lambda/SQS/SNS/DynamoDB/S3/API Gateway/IAM) are deploy-confident, and 55 AWS
node lowerers are genuinely registered — but relationship modeling compiles
only two edge patterns, and the day-2 operational surface (destroy,
environments, configured state backend, real secret resolution, policy
exceptions) is largely absent or ambient. Most of these gaps are already
tracked in `../product-management/backlog.md` (EE-1..5, MCA-\*).

### Scorecard

| Dimension                   | Rollup  | Blockers | High | Notes                                             |
| --------------------------- | ------- | -------- | ---- | ------------------------------------------------- |
| A. Packaging & Distribution | Blocker | 4        | 3    | Publish would fail or ship broken artifacts       |
| B. Legal & Security         | Blocker | 2        | 1    | No LICENSE file; no SECURITY.md                   |
| C. Documentation (consumer) | High    | 0        | 3    | Excellent CLI docs; no library-consumption story  |
| D. Contribution & Community | Blocker | 1        | 2    | No community-health files at all                  |
| E. Developer Experience     | High    | 0        | 2    | Real programmatic surface, undocumented           |
| F. Agent Experience         | High    | 0        | 3    | Rich scaffolding, systemic frontmatter/drift gaps |
| G. Quality & Standards      | Medium  | 0        | 0    | Strongest dimension                               |
| H. Capability Baseline      | High    | 0        | 5    | MVP real; day-2 operations missing                |

Blocker counts: individual criteria rated Fail/Blocker. Fixing the 7 blocker
criteria (~P0 backlog below) moves the verdict to **Ready with Caveats**.

## Findings by Dimension

### A. Packaging & Distribution — Blocker

| ID      | Status  | Severity | Finding                                                                                                                                                                                                                                                       |
| ------- | ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LR-A-01 | Fail    | High     | No package declares `license`, `repository`, `author`, `homepage`, `bugs`, or `publishConfig`. `@shinobi/validation` has no `types` field and its `exports` map lacks a `types` condition (`packages/validation/package.json`).                               |
| LR-A-02 | Fail    | Blocker  | `@shinobi/validation` builds with `dts: false` (`packages/validation/tsup.config.ts`) yet is a dependency of public `@shinobi/kernel` — TypeScript consumers of the kernel get broken/incomplete types.                                                       |
| LR-A-03 | Fail    | Blocker  | `@shinobi/cli` manifest is publish-broken: `main: src/index.ts` (TS source), no `files` allowlist, no `type`, not marked `private` (`packages/cli/package.json`). The other 8 packages have correct `files: ["dist"]` but tarballs include no README/LICENSE. |
| LR-A-04 | Fail    | High     | `@pulumi/pulumi` / `@pulumi/aws` are hard `dependencies` in `packages/adapters/aws` and `packages/cli`; no `peerDependencies` anywhere — risks duplicate Pulumi instances in consumer programs.                                                               |
| LR-A-05 | Partial | Medium   | ESM-only (`format: ['esm']` across libs) is a defensible policy but undocumented and unvalidated — no `publint` / `arethetypeswrong` / `npm pack` verification in CI.                                                                                         |
| LR-A-06 | Fail    | Blocker  | `.changeset/config.json` sets `access: "restricted"` — packages cannot publish publicly as configured. CHANGELOG.md missing for 5 of 9 packages (binder, policy, conformance, cli, adapter-aws); version drift 0.0.1 vs 0.0.2.                                |
| LR-A-07 | Fail    | Blocker  | No release workflow: `.github/workflows/` has ci.yml, deploy-atlas.yml, holdout-request-tag.yml — nothing runs `changeset version`/`publish`, no npm auth, no provenance.                                                                                     |
| LR-A-08 | Partial | Medium   | `scripts/consumer-smoke.mjs` exists and runs in CI, but imports from built workspace `dist/`, not from packed tarballs — it cannot catch manifest/packaging errors like LR-A-02/03.                                                                           |

### B. Legal & Security Posture — Blocker

| ID      | Status | Severity | Finding                                                                                                                |
| ------- | ------ | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| LR-B-01 | Fail   | Blocker  | **No LICENSE file exists anywhere** (root or per-package) despite `"license": "MIT"` in the root `package.json`.       |
| LR-B-02 | Fail   | Blocker  | Follows from LR-B-01 — no tarball can include a license.                                                               |
| LR-B-03 | Fail   | High     | No SECURITY.md / vulnerability disclosure policy — notable for a tool that generates IAM and network security posture. |
| LR-B-04 | Pass   | —        | `pnpm-lock.yaml` committed; CI uses `--frozen-lockfile` (`.github/workflows/ci.yml`).                                  |
| LR-B-05 | Fail   | Medium   | No provenance setup (follows from LR-A-07).                                                                            |

### C. Documentation (Consumer-Facing) — High

| ID      | Status  | Severity | Finding                                                                                                                                                                                                                                                     |
| ------- | ------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LR-C-01 | Partial | High     | Root `README.md` is excellent for **CLI** consumption (quickstart, MVP matrix with honest caveats, doc map) but contains no library story — no `pnpm add @shinobi/kernel`, no import example.                                                               |
| LR-C-02 | Fail    | High     | All 9 per-package READMEs are 5-line stubs ("Part of the Shinobi V3 monorepo"). As npm landing pages they say nothing about install or API.                                                                                                                 |
| LR-C-03 | Fail    | High     | No generated API reference — no typedoc config or output. Programmatic integrators must read `src/index.ts` barrels.                                                                                                                                        |
| LR-C-04 | Partial | Medium   | CLI surface: strong (`docs/getting-started.md`, `docs/user/cli-reference.md`, `docs/user/manifest-authoring-guide.md`, `docs/cookbook/`). Programmatic surface: only `docs/integrations/harmony.md` (partner-specific). Agent surface: partial.             |
| LR-C-05 | Partial | Medium   | Consumer docs are intermixed with internal material: `docs/operations/` carries ~25 files of dated Harmony release evidence; root has working logs (`LOG.md`, `agent-instructions.md`). A newcomer cannot tell public from internal.                        |
| LR-C-06 | Partial | Medium   | Documented claims contradict each other: `docs/operations/environment-matrix.md` says telemetry intents are "ignored" while `packages/adapters/aws/src/lowerers/telemetry-lowerer.ts` emits X-Ray IAM for traces; CLAUDE.md counts are stale (see LR-F-01). |

### D. Contribution & Community — Blocker

| ID      | Status  | Severity | Finding                                                                                                                                                                                 |
| ------- | ------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LR-D-01 | Fail    | Blocker  | No CONTRIBUTING.md. Contribution guidance that exists is agent-oriented and scattered (CLAUDE.md, `roles.md`, `agent-instructions.md`) — there is no human-contributor onboarding path. |
| LR-D-02 | Fail    | High     | No CODE_OF_CONDUCT.md.                                                                                                                                                                  |
| LR-D-03 | Fail    | High     | No issue templates, no PR template — `.github/` contains only workflows.                                                                                                                |
| LR-D-04 | Fail    | Medium   | No CODEOWNERS.                                                                                                                                                                          |
| LR-D-05 | Partial | Low      | Git history uses conventional-style prefixes by habit; nothing enforces or documents them (no commitlint/husky).                                                                        |
| LR-D-06 | Fail    | Medium   | No documented release process (blocked on LR-A-07 existing at all).                                                                                                                     |

### E. Developer Experience (Integrator) — High

| ID      | Status  | Severity | Finding                                                                                                                                                                                                                                                                                                                                            |
| ------- | ------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LR-E-01 | Partial | High     | A real programmatic surface exists — `packages/cli/src/index.ts` exports `parseManifest`, `validate`, `plan`, `up`, `createCli`; the kernel facade and registries are public — but no document says "to embed Shinobi, import X and call Y." `docs/integrations/harmony.md` is the closest and scopes public packages as contracts/ir/kernel only. |
| LR-E-02 | Fail    | High     | All 3 `examples/` are CLI-consumed YAML manifests; no example exercises the library API programmatically.                                                                                                                                                                                                                                          |
| LR-E-03 | Fail    | Medium   | Extension points exist in code (`Kernel` constructor accepts `binders`/`evaluators`; `BinderRegistry.register`, `NodeLowererRegistry.register` with `overwrite`) but are entirely undocumented.                                                                                                                                                    |
| LR-E-04 | Fail    | Medium   | No public-surface designation or semver/stability policy. Harmony doc declares policy/binder/conformance/adapters "not public," which contradicts publishing them all to npm.                                                                                                                                                                      |
| LR-E-05 | Pass    | —        | Errors are structured `{path, message}` objects with stable paths (KL-002/KL-006); CLI exposes `--json` on every command.                                                                                                                                                                                                                          |
| LR-E-06 | Fail    | Medium   | Changesets `fixed`/`linked` are empty and versions already drift (0.0.1 vs 0.0.2); no stated compatibility policy across `@shinobi/*`.                                                                                                                                                                                                             |

### F. Agent Experience — High

| ID      | Status  | Severity | Finding                                                                                                                                                                                                                                                                                                                  |
| ------- | ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| LR-F-01 | Fail    | High     | CLAUDE.md drift: skills table lists 17 of 24 on-disk skills; claims "14 standards" (13 exist in `docs/standards/`); claims "28 conformance gates" (`docs/conformance/gates.md` has 12 gate rows — 28 is the file's line count); lowerer/rule counts stale. `docs/operations/current-roadmap.md` itself flags this drift. |
| LR-F-02 | Fail    | High     | 14 of 24 `.claude/skills/*/SKILL.md` lack YAML frontmatter entirely — no `name`/`description` trigger text, so agents get degraded discovery (e.g. `binder-logic-synthesis` surfaces its H1 as description). Typo directory: `adapter-lowering-contractacts`.                                                            |
| LR-F-03 | Fail    | Medium   | Four parallel skill roots with no sync: `.claude/skills/` (24), `.cursor/skills/` (full copies), `.agent/` + `.codex/` (single symlinks into `.agents/`), plus `docs/skills/` (20, overlapping-but-different set). Silent divergence guaranteed.                                                                         |
| LR-F-04 | Fail    | High     | **No JSON Schema artifacts** (`*.schema.json`) exist anywhere despite schema-driven validation being a core standard (`docs/standards/graph-ir-schema.md`, `manifest-validation.md`). External agents/tools cannot validate manifests without executing the TS library.                                                  |
| LR-F-05 | Pass    | —        | `--json` and `--harmony-envelope` with trace IDs on all commands; MCP wrapper in `packages/cli/src/mcp/` with versioned envelopes and async operation handles.                                                                                                                                                           |
| LR-F-06 | Partial | Medium   | No AGENTS.md / llms.txt. `docs/integrations/harmony.md` and `docs/standards/agent-tool-protocol.md` cover much of the ground but there is no single canonical agent-consumer entry point.                                                                                                                                |

### G. Quality & Standards — Medium (strongest dimension)

| ID      | Status  | Severity | Finding                                                                                                                                                                                                                                                                                  |
| ------- | ------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LR-G-01 | Pass    | —        | `ci.yml` runs format:check, build, test, lint, conformance:check, smoke:consumer, blueprints:check, roadmap:check, rollout dashboard, and a docs job — on every push/PR.                                                                                                                 |
| LR-G-02 | Pass    | —        | `@nx/enforce-module-boundaries` in `.eslintrc.json` encodes the full package dependency graph with scope tags; kernel/binder/policy cannot import adapters.                                                                                                                              |
| LR-G-03 | Pass    | —        | Conformance/determinism gates run in CI (`pnpm conformance:check`); golden cases + triad matrix in `packages/conformance`.                                                                                                                                                               |
| LR-G-04 | Partial | Medium   | `@vitest/coverage-v8` is present but no coverage threshold is enforced in CI.                                                                                                                                                                                                            |
| LR-G-05 | Partial | Medium   | ~1,778 tests / 121 spec files verified. However the suite skews shape/determinism validation; deploy realism is concentrated in the MVP families and live-cloud smoke is optional/env-gated (`SHINOBI_RUN_PULUMI_SMOKE`) — the one unresolved finding from the 2026-02-15 reality audit. |
| LR-G-06 | Partial | Low      | Vitest is the real runner per package, but legacy `jest.config.ts`/`jest.preset.js` remain at root — confusing signal.                                                                                                                                                                   |

### H. Capability Baseline — High

The functional floor for a consuming platform team, per area. Tiers:
**deploy-confident** vs **shape-tested** (structure/determinism only).

| ID      | Status  | Severity | Finding                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------- | ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LR-H-01 | Partial | High     | Two-tier reality: 55 node lowerers genuinely registered (`packages/adapters/aws/src/lowerer-registry.ts`) spanning ECS/EKS/RDS/VPC/CloudFront/MSK/SageMaker/etc., but only ~7 families (Lambda/SQS/SNS/DynamoDB/S3/APIGW/IAM) are deploy-confident per the reality audit; the rest are shape-tested. The README matrix **understates** capability while test evidence **overstates** deployability. No published tiering. |
| LR-H-02 | Fail    | High     | Only 2 edge patterns compile: `bindsTo: component→platform` and `triggers: platform→component` (registered in `packages/cli/src/commands/validate.ts`). The manifest parser accepts `dependsOn`, `contains`, and other type pairs, which then **silently produce no intents** — a correctness trap for consumers.                                                                                                         |
| LR-H-03 | Fail    | High     | validate/plan/up implemented (with real Pulumi preview and Automation API deploy). **No destroy** (`docs/operations/destroy-runbook.md` punts to manual `pulumi stack destroy`; backlog EE-1/EE-2), no standalone diff, no refresh, no import, no drift detection (`readActivity` returns empty by contract in `packages/kernel/src/facade/facade.ts`).                                                                   |
| LR-H-04 | Fail    | High     | Config precedence engine implemented (`resolveConfig` in `packages/kernel/src/config.ts`, KL-007) but **unwired**: no `--environment` flag, CLI never feeds an environment layer, and stack naming `{service}-{region}` collides across environments (backlog EE-3/EE-5). `docs/operations/environment-matrix.md` prescribes behavior the CLI cannot express.                                                             |
| LR-H-05 | Fail    | High     | Secrets are placeholder: a `secret` node type and `secretRef` valueSource exist, but the adapter passes the unresolved ref object straight into Lambda env vars (`packages/adapters/aws/src/adapter.ts`) — no SecretsManager resolution, no Pulumi secret outputs (backlog EE-4).                                                                                                                                         |
| LR-H-06 | Fail    | Medium   | State backend is ambient: `packages/adapters/aws/src/deployer.ts` creates stacks with no `backend`, `secretsProvider`, or `pulumiHome` — state lands wherever the runner's `~/.pulumi`/`PULUMI_BACKEND_URL` points (backlog EE-4).                                                                                                                                                                                        |
| LR-H-07 | Pass    | —        | 3 policy packs (Baseline, FedRAMP-Moderate, FedRAMP-High) implemented as data — one evaluator, packs differ only by severity map, ~44-45 rules in `packages/policy/src/rules.ts`. No pack branching (KL-008 upheld).                                                                                                                                                                                                      |
| LR-H-08 | Fail    | Medium   | Exception/waiver/escape-hatch model is docs-only (`docs/standards/exception-model.md`, `escape-hatch-governance.md`) — zero implementation in `packages/`: no exception records, TTL, or suppression path in the evaluator.                                                                                                                                                                                               |
| LR-H-09 | Partial | Medium   | IR carries origin provenance (`packages/ir/src/types/provenance.ts`: sourceFile, component, lineNumber, derivedFrom) — real and used. But a "why"/explainability output module per the standard does not exist as code.                                                                                                                                                                                                   |
| LR-H-10 | Partial | High     | Library-level extension works (Kernel ctor `binders`/`evaluators`; registry `register()` APIs). **No-fork CLI extension is impossible**: the CLI hard-codes binders/evaluators and hard-imports `@shinobi/adapter-aws`; no Adapter interface or plugin mechanism (backlog E1/MCA-1). A platform team must build its own entry point.                                                                                      |
| LR-H-11 | Partial | Medium   | Region is a first-class `--region` flag; account is purely ambient AWS credentials. No account targeting, cross-account, or multi-region-per-deploy. Multi-cloud is backlog Epic E1 (MCA-\*) — kernel/IR are provider-neutral by design, so the path exists.                                                                                                                                                              |
| LR-H-12 | Pass    | —        | Gaps are candidly tracked: `docs/product-management/backlog.md` (EE-1..5, MCA-0..10), `docs/operations/current-roadmap.md`, and the 2026-02-15 reality audit with per-finding remediation status.                                                                                                                                                                                                                         |

## Strengths Worth Preserving

- **Deterministic core with enforced boundaries** — the ESLint-encoded
  dependency graph and conformance/determinism gates are exactly what gives a
  consumer trust in an IaC compiler.
- **Honest-caveat culture** — the README MVP matrix, the reality audit, and
  the backlog all state limitations plainly. This audit's job was easy because
  the repo already tells the truth about itself.
- **Structured output everywhere** — `--json`, Harmony envelopes, trace IDs,
  MCP wrapper: the agent-consumption plumbing is ahead of most libraries.
- **Blueprints + Atlas** — 20+ CI-validated reference manifests and a
  zero-build DevEx portal (`site/`) are strong adoption assets.
- **1,778 tests / 121 spec files**, consumer smoke test, and per-package
  vitest — the quality floor is real.

## Prioritized Remediation Backlog

Effort: S (≤half day), M (1–3 days), L (1–2 weeks), XL (multi-week).

### P0 — Publish blockers (verdict gates on all of these)

| #   | Item                                                                                                                             | Criteria            | Effort |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ------ |
| 1   | Add root LICENSE (MIT) and `license` field to every package; include LICENSE+README in `files`                                   | LR-B-01/02, LR-A-01 | S      |
| 2   | Set changesets `access: "public"`; backfill CHANGELOGs for the 5 packages missing them                                           | LR-A-06             | S      |
| 3   | Enable `dts: true` for `@shinobi/validation`; add `types` field and exports condition                                            | LR-A-02             | S      |
| 4   | Fix `@shinobi/cli` manifest: built `main`, `files: ["dist"]`, `type`, or mark `private: true` if npm distribution isn't intended | LR-A-03             | S      |
| 5   | Add release workflow (changesets action: version PR + publish with NPM_TOKEN and `--provenance`)                                 | LR-A-07, LR-B-05    | M      |
| 6   | Add CONTRIBUTING.md (setup, conventions, how to run the CI gates locally)                                                        | LR-D-01             | S      |
| 7   | Add `repository`/`homepage`/`bugs`/`publishConfig` to all package manifests                                                      | LR-A-01             | S      |

### P1 — First public milestone (fix or document before promoting adoption)

| #   | Item                                                                                                                                           | Criteria               | Effort |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------ |
| 8   | Write the integration guide: public packages, entry points, embed sequence, extension points (binders/lowerers/evaluators), stability policy   | LR-E-01/03/04, LR-C-01 | M      |
| 9   | Convert `@pulumi/*` to peerDependencies in adapter-aws (and cli if published)                                                                  | LR-A-04                | S      |
| 10  | Emit JSON Schemas for manifest/plan/envelope as build artifacts                                                                                | LR-F-04                | M      |
| 11  | Reject (or warn loudly on) manifest edges that no registered binder compiles — eliminate silent no-op edges                                    | LR-H-02                | M      |
| 12  | Publish the component support matrix with explicit deploy-confident vs shape-tested tiers; reconcile README/env-matrix/telemetry contradiction | LR-H-01, LR-C-06       | S–M    |
| 13  | Add `destroy` to the CLI (wrap `pulumi stack destroy` via Automation API) — backlog EE-1/EE-2                                                  | LR-H-03                | M      |
| 14  | Wire `--environment` into `resolveConfig` and stack naming — backlog EE-3/EE-5                                                                 | LR-H-04                | M      |
| 15  | Resolve secret refs to real SecretsManager references; configure stack `secretsProvider` and backend — backlog EE-4                            | LR-H-05/06             | M–L    |
| 16  | Fix CLAUDE.md drift (skill table, standards/gates/lowerer/rule counts); fix skill frontmatter (14 files) and `contractacts` typo               | LR-F-01/02             | S      |
| 17  | Add SECURITY.md, CODE_OF_CONDUCT.md, issue/PR templates, CODEOWNERS                                                                            | LR-B-03, LR-D-02/03/04 | S      |
| 18  | Per-package READMEs: purpose, install, minimal example (these become npm landing pages)                                                        | LR-C-02                | M      |
| 19  | Add `publint` + `arethetypeswrong` + tarball-based smoke to CI                                                                                 | LR-A-05/08             | M      |

### P2 — Polish and depth

| #   | Item                                                                                                                        | Criteria            | Effort |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ------------------- | ------ |
| 20  | Typedoc API reference for public packages, published via the existing Pages workflow                                        | LR-C-03             | M      |
| 21  | Single-source the skill roots (generate `.cursor`/`.agents` copies or symlink); reconcile `docs/skills` vs `.claude/skills` | LR-F-03             | M      |
| 22  | AGENTS.md as the canonical agent-consumer entry point                                                                       | LR-F-06             | S      |
| 23  | Implement the exception/waiver model in the policy evaluator per `docs/standards/exception-model.md`                        | LR-H-08             | L      |
| 24  | Explainability ("why") output module per KL-006                                                                             | LR-H-09             | L      |
| 25  | Adapter interface + no-fork CLI extensibility — backlog MCA-1/3                                                             | LR-H-10             | XL     |
| 26  | Programmatic example in `examples/`; expanded binder coverage (`dependsOn`, component→component)                            | LR-E-02, LR-H-02    | M–L    |
| 27  | Coverage thresholds in CI; remove legacy jest configs; separate public docs tree from internal ops evidence                 | LR-G-04/06, LR-C-05 | M      |

## Method

- Evidence gathered via four parallel repository sweeps (packaging/publishing,
  docs/contribution/DX, agent experience, functional capability), 2026-07-12.
- Load-bearing blocker claims re-verified by direct file inspection:
  `.changeset/config.json`, `packages/validation/package.json` +
  `tsup.config.ts`, `packages/cli/package.json`, LICENSE glob (no matches).
- Test suites were not executed as part of this audit; test counts are static
  (121 spec files, ~1,778 `it`/`test` calls) and pass/green state is asserted
  by CI history, not re-verified here.
- Existing internal findings were cross-referenced, not duplicated: see
  `2026-02-15-reality-audit.md` and `../product-management/backlog.md`
  (EE-\*, MCA-\*).

## Remediation Log

### 2026-07-12 — P0 batch (all publish blockers) + P1 item 17

| P0 item | Status | What was done                                                                                                                                                                                                                                          |
| ------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1       | Done   | Root `LICENSE` (MIT) added and copied into every package dir so npm includes it in tarballs; `license: "MIT"` declared in all 9 package manifests. Verified via `npm pack --dry-run`: tarballs now contain LICENSE + README + dist.                    |
| 2       | Done   | `.changeset/config.json` `access` → `"public"`; CHANGELOG.md backfilled for binder, policy, conformance, cli, adapter-aws.                                                                                                                             |
| 3       | Done   | `@shinobi/validation` now emits declarations: `dts: true` via a new `tsconfig.build.json` (adapter-aws pattern — extends the root tsconfig without source path mappings); `types` field + exports `types` condition added. `dist/index.d.ts` verified. |
| 4       | Done   | `@shinobi/cli` manifest fixed: `type: "commonjs"`, `main`/`types`/`exports` point at built `dist/`, `files: ["dist"]`. tsup now builds `src/index.ts` (programmatic surface) alongside the `main.ts` bin, with declarations for the index entry.       |
| 5       | Done   | `.github/workflows/release.yml` added: changesets action creates the Version Packages PR and publishes on merge with `NPM_TOKEN` + npm provenance (`id-token: write`). Requires the `NPM_TOKEN` repo secret to be configured.                          |
| 6       | Done   | `CONTRIBUTING.md` added: setup, local CI-gate sequence, commit conventions, changeset/release flow, where to find work.                                                                                                                                |
| 7       | Done   | `repository` (with `directory`), `homepage`, `bugs`, and `publishConfig.access: "public"` added to all 9 package manifests; `repository`/`homepage`/`bugs` added to the root manifest.                                                                 |
| 17 (P1) | Done   | `SECURITY.md`, `CODE_OF_CONDUCT.md`, `.github/ISSUE_TEMPLATE/` (bug + feature), `.github/PULL_REQUEST_TEMPLATE.md`, `.github/CODEOWNERS` added.                                                                                                        |

Side effects worth noting: enabling the CLI declaration build gave the CLI its
first real typecheck (vitest transpiles without checking; dts was previously
off). That surfaced and fixed six latent type errors — literal-widening of the
error-envelope `category` in `src/integration/envelope.ts`, missing explicit
generics on failure-path `buildEnvelope` calls, and four boundary casts in
`src/mcp/wrapper.ts` now routed through `unknown`. No runtime behavior changed.

Verified after the batch: full fresh build (9/9), full test suite (9/9
projects), lint, conformance (12/12), consumer smoke, blueprints/roadmap/
dashboard/docs checks, and `npm pack --dry-run` tarball inspection for
validation, cli, and kernel.

Remaining before first publish: configure the `NPM_TOKEN` secret, then merge a
changeset to trigger the release workflow. P1 items 8–16 and 18–19 remain
open.
