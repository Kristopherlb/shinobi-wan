# Library Readiness Audit Framework

Status: Active
Owner: Contract Steward (R6) with Kernel/Graph Engineer (R1) support
First executed: 2026-07-12 (see `2026-07-12-library-readiness-audit.md`)

## Purpose

Define a repeatable audit that answers one question: **is Shinobi ready to be
consumed as a standalone, public library/package by an external platform
team?** "Consumed" covers three integration surfaces:

1. **Programmatic** — importing `@shinobi/*` packages and embedding the
   kernel/binder/policy pipeline in a platform.
2. **CLI** — using the `shinobi` binary (`validate` / `plan` / `up`) in
   pipelines and local workflows.
3. **Agent** — AI agents authoring manifests, invoking tools, and integrating
   via structured envelopes (MCP/Harmony).

The framework is normative: each criterion has a check and a pass bar. It is
designed to be re-run before any public release and to gate the first
`v0.x` npm publish.

## Scoring Model

### Per-criterion status

| Status  | Meaning                                                        |
| ------- | -------------------------------------------------------------- |
| Pass    | Criterion fully met with evidence                              |
| Partial | Partially met; gap is bounded and documented                   |
| Fail    | Not met                                                        |
| N/A     | Not applicable at the current release tier (must be justified) |

### Per-criterion severity (assigned to non-Pass results)

| Severity | Meaning                                                                          |
| -------- | -------------------------------------------------------------------------------- |
| Blocker  | Prevents a responsible public `v0.x` publish (legal, broken install, dead types) |
| High     | Materially degrades adoption or trust; fix within the first public milestone     |
| Medium   | Noticeable friction; schedule within a release or two                            |
| Low      | Polish; opportunistic                                                            |

### Verdict tiers (overall rollup)

| Tier               | Definition                                                             |
| ------------------ | ---------------------------------------------------------------------- |
| Not Ready          | One or more Blockers open                                              |
| Ready with Caveats | Zero Blockers; High findings exist but are documented in release notes |
| Ready              | Zero Blockers, zero Highs; Medium/Low tracked in backlog               |

A dimension's rollup is the worst severity among its non-Pass criteria.

## Dimensions and Criteria

### A. Packaging & Distribution

| ID      | Criterion                                                                                                   | How to check                                                        | Pass bar                                                             |
| ------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------- |
| LR-A-01 | Every publishable package declares `name`, `version`, `license`, `repository`, `main`/`exports`, `types`    | Inspect `packages/*/package.json`                                   | All fields present; `exports` map includes a `types` condition       |
| LR-A-02 | Type declarations ship for every package on the public dependency chain                                     | Check `tsup.config.ts` `dts` flags; build and inspect `dist/*.d.ts` | Every package reachable from a public entry point emits declarations |
| LR-A-03 | Packages not intended for npm are marked `private: true`; the rest have correct `files` allowlists          | Inspect manifests; `npm pack --dry-run` per package                 | Tarballs contain only `dist` + README + LICENSE                      |
| LR-A-04 | Provider SDKs (`@pulumi/*`) are `peerDependencies` in packages consumers install alongside their own Pulumi | Inspect adapter and CLI manifests                                   | Peer deps declared with documented supported ranges                  |
| LR-A-05 | Module format decision is explicit and validated (ESM-only is acceptable if documented)                     | Run `publint` and `arethetypeswrong` against packed tarballs        | No errors; format policy stated in docs                              |
| LR-A-06 | Release tooling is publish-ready: changesets `access` correct, versioning consistent, CHANGELOGs exist      | Inspect `.changeset/config.json`, per-package `CHANGELOG.md`        | `access: "public"`; CHANGELOG for every publishable package          |
| LR-A-07 | CI automates release: version PR + publish on merge with npm auth and provenance                            | Inspect `.github/workflows/`                                        | A working release workflow exists (e.g. `changesets/action`)         |
| LR-A-08 | A consumer smoke test installs the packed tarballs (not workspace links) and exercises the public API       | Inspect smoke scripts and CI wiring                                 | Smoke test runs against `npm pack` output in CI                      |

### B. Legal & Security Posture

| ID      | Criterion                                                                           | How to check                                              | Pass bar                                               |
| ------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------ |
| LR-B-01 | LICENSE file exists at repo root and matches the declared `license` field           | `ls LICENSE*`; compare to package.json                    | Present, OSI-approved, consistent everywhere           |
| LR-B-02 | Every published tarball includes the license                                        | `npm pack --dry-run` contents                             | LICENSE (or license field + root link) in each tarball |
| LR-B-03 | SECURITY.md defines a vulnerability disclosure path                                 | `ls SECURITY.md`                                          | Present with contact and response expectations         |
| LR-B-04 | Supply-chain hygiene: committed lockfile, frozen installs in CI, secret scanning on | Inspect `pnpm-lock.yaml`, CI flags, repo settings         | All three in place                                     |
| LR-B-05 | npm provenance enabled for publishes                                                | Release workflow uses `--provenance` / trusted publishing | Enabled                                                |

### C. Documentation (Consumer-Facing)

| ID      | Criterion                                                                                        | How to check                                     | Pass bar                                                           |
| ------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------ |
| LR-C-01 | Root README covers **library** consumption: install, import, minimal programmatic example        | Read `README.md`                                 | A platform integrator can embed the kernel from README alone       |
| LR-C-02 | Per-package READMEs describe purpose, install, and API surface (these are the npm landing pages) | Read `packages/*/README.md`                      | More than a stub: purpose + example + link to reference            |
| LR-C-03 | Generated API reference exists for public packages                                               | Look for typedoc (or equivalent) config + output | Published or CI-built reference for the public surface             |
| LR-C-04 | A getting-started path exists for each integration surface (programmatic, CLI, agent)            | Read `docs/getting-started.md`, `docs/user/`     | All three surfaces have an entry path                              |
| LR-C-05 | Public consumer docs are separable from internal working docs (ops evidence, agent logs)         | Review `docs/` tree organization                 | A newcomer can find consumer docs without wading through internals |
| LR-C-06 | Documented claims match reality (counts, support matrices, caveats)                              | Cross-check README/CLAUDE.md/env-matrix vs code  | No contradictions among docs or between docs and code              |

### D. Contribution & Community

| ID      | Criterion                                                                                       | How to check                          | Pass bar                                                 |
| ------- | ----------------------------------------------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------- |
| LR-D-01 | CONTRIBUTING.md covers setup, branch/commit conventions, PR expectations, and how to run checks | `ls CONTRIBUTING.md`                  | Present and matches actual CI gates                      |
| LR-D-02 | CODE_OF_CONDUCT.md present                                                                      | `ls CODE_OF_CONDUCT.md`               | Present                                                  |
| LR-D-03 | Issue and PR templates exist                                                                    | `ls .github/ISSUE_TEMPLATE/` etc.     | Bug/feature issue forms + PR template                    |
| LR-D-04 | CODEOWNERS routes reviews                                                                       | `ls .github/CODEOWNERS`               | Present for the package tree                             |
| LR-D-05 | Commit conventions are enforced, not just customary                                             | Look for commitlint/husky or CI check | Enforcement exists, or convention documented as advisory |
| LR-D-06 | The release process is documented (how a change becomes a published version)                    | Look for release docs                 | A contributor can follow it end to end                   |

### E. Developer Experience (Integrator)

| ID      | Criterion                                                                                             | How to check                                        | Pass bar                                                    |
| ------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------- |
| LR-E-01 | A "how to embed Shinobi" integration guide names the public packages, entry points, and call sequence | Look for an integration doc                         | Import X, call Y is written down, not reverse-engineered    |
| LR-E-02 | Examples exercise the **library API**, not only the CLI                                               | Review `examples/`                                  | At least one runnable programmatic example                  |
| LR-E-03 | Extensibility is documented: registering custom binders, lowerers, and policy evaluators              | Review docs vs `Kernel` ctor / registry APIs        | Documented with a worked example                            |
| LR-E-04 | The public API surface is explicitly designated and has a stability/versioning policy                 | Look for a public-surface statement + semver policy | Consumers know what is stable vs internal                   |
| LR-E-05 | Errors and diagnostics are structured, stable, and actionable (KL-002/KL-006)                         | Inspect error shapes; run `validate` on bad input   | `{path, message}`-style structured errors with stable paths |
| LR-E-06 | Version compatibility across `@shinobi/*` packages is defined (which versions work together)          | Check changesets `fixed`/`linked` or docs           | A stated policy (lockstep or compatibility table)           |

### F. Agent Experience

| ID      | Criterion                                                                                   | How to check                                          | Pass bar                                                      |
| ------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------- |
| LR-F-01 | CLAUDE.md (and equivalents) is accurate: commands, counts, package list, current state      | Cross-check claims against the tree                   | No stale or wrong claims                                      |
| LR-F-02 | Every skill has valid YAML frontmatter with `name` and a "use when" `description`           | Inspect `.claude/skills/*/SKILL.md` headers           | 100% of skills discoverable with trigger text                 |
| LR-F-03 | Skill roots for different agent tools are single-sourced (no unsynced full copies)          | Compare `.claude/`, `.cursor/`, `.agent*/`, `.codex/` | One source of truth; others are links or generated            |
| LR-F-04 | Machine-readable schemas are published as artifacts (manifest, plan, envelope JSON Schemas) | Look for `*.schema.json` in-tree or emitted at build  | External tools/agents can validate without running the TS lib |
| LR-F-05 | CLI/tool output is structured for agent consumption (`--json`, envelopes, trace IDs)        | Inspect CLI options and envelope builders             | Structured modes on every command                             |
| LR-F-06 | An agent-facing consumption doc exists (AGENTS.md or equivalent) covering the tool protocol | Look for AGENTS.md / integration contract docs        | One canonical agent-consumer entry point                      |

### G. Quality & Standards

| ID      | Criterion                                                                                | How to check                                      | Pass bar                                            |
| ------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------- |
| LR-G-01 | CI runs build, test, lint, format, and conformance on every PR                           | Inspect `.github/workflows/ci.yml`                | All gates wired and required                        |
| LR-G-02 | Architectural boundaries are mechanically enforced (kernel cannot import adapters, etc.) | Inspect ESLint module-boundary rules              | Dependency graph encoded and failing on violation   |
| LR-G-03 | Determinism gates run in CI (byte-stable outputs, stable IDs)                            | Inspect conformance checks                        | Determinism verified per KL-001                     |
| LR-G-04 | Coverage is measured with a stated threshold                                             | Inspect vitest/coverage config and CI             | Threshold enforced or explicitly waived with reason |
| LR-G-05 | Test claims match reality; tests distinguish shape-validation from deploy-validation     | Spot-check suites vs claims; review reality audit | Claims accurate; deploy-confidence tiers stated     |
| LR-G-06 | One test runner story (no dual jest/vitest legacy confusion)                             | Inspect root configs                              | Single runner or documented reason for both         |

### H. Capability Baseline (Core Functionality Teams Need)

This dimension audits the **functional floor** a platform team requires,
independent of packaging polish. Tier language: **deploy-confident**
(exercised against real provider behavior) vs **shape-tested** (structure and
determinism only).

| ID      | Criterion                                                                                                 | How to check                                              | Pass bar                                                               |
| ------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------- |
| LR-H-01 | Component coverage is honestly tiered: which node types are deploy-confident vs shape-tested              | Compare lowerer registry vs README matrix vs test realism | A published support matrix with explicit tiers; no over/under-claiming |
| LR-H-02 | Binder coverage: the edge types the manifest accepts all compile to intents, or are rejected loudly       | Compare parser-accepted edges vs registered binders       | No edge silently compiles to nothing                                   |
| LR-H-03 | Lifecycle verbs: validate, plan/preview, apply, **destroy** at minimum; diff/refresh/import/drift stated  | Inspect CLI commands and runbooks                         | Teardown exists (or a supported documented path); gaps stated          |
| LR-H-04 | Environment support: named environments wired into config precedence; per-env stack isolation             | Inspect CLI flags, `resolveConfig` wiring, stack naming   | `--environment` (or equivalent) affects config and stack identity      |
| LR-H-05 | Secrets: secret refs resolve to real provider secrets, never plaintext/unresolved passthrough             | Trace secret valueSource through adapter                  | Secret refs materialize as provider secret references                  |
| LR-H-06 | State backend: configurable (backend URL, secrets provider), not ambient                                  | Inspect deployer/workspace setup                          | Backend and secrets provider are explicit configuration                |
| LR-H-07 | Policy packs implemented as data with no pack branching (KL-008)                                          | Inspect policy engine and rule catalog                    | Packs real, rules data-driven                                          |
| LR-H-08 | Exception/waiver/escape-hatch model implemented, not just documented                                      | Grep for waiver/exception handling in evaluator           | Suppression records with scope + expiry enforced in code               |
| LR-H-09 | Explainability: "why" provenance available for derived resources and policy decisions (KL-006)            | Inspect provenance + explain outputs                      | A consumer can ask why a resource/violation exists                     |
| LR-H-10 | Extensibility without forking: custom components/binders/policies usable through the shipped entry points | Inspect CLI/facade for registration or plugin config      | Extension possible without patching the repo                           |
| LR-H-11 | Multi-account/multi-region posture is explicit                                                            | Inspect flags and deployer                                | Supported modes and limits documented                                  |
| LR-H-12 | Known functional gaps are tracked in a public roadmap/backlog consumers can see                           | Review roadmap/backlog docs                               | Gaps enumerated with IDs and status                                    |

## How to Re-run This Audit

Run from the repo root. Record evidence paths for every non-Pass finding.

```bash
# Build, test, lint, format — the baseline gates
pnpm install --frozen-lockfile
pnpm nx run-many -t build
pnpm nx run-many -t test
pnpm nx run-many -t lint
pnpm run format:check

# Repo-specific quality gates
pnpm conformance:check
pnpm smoke:consumer
pnpm blueprints:check
pnpm docs:check

# Packaging checks (per publishable package)
cd packages/<pkg> && npm pack --dry-run   # inspect tarball contents
npx publint packages/<pkg>                 # manifest/export correctness
npx @arethetypeswrong/cli --pack packages/<pkg>  # type resolution

# Spot checks
ls LICENSE* SECURITY.md CONTRIBUTING.md CODE_OF_CONDUCT.md .github/CODEOWNERS
cat .changeset/config.json                 # access must be "public"
grep -L '^---' .claude/skills/*/SKILL.md   # skills missing frontmatter
find . -name '*.schema.json' -not -path '*/node_modules/*'
```

For dimension H, compare three sources and reconcile any disagreement:
the README support matrix, `packages/adapters/aws/src/lowerer-registry.ts`,
and the registered binders in `packages/cli/src/commands/validate.ts`.

## Cadence and Governance

- Execute before every public release; the executed report is a dated file in
  `docs/audit/` (precedent: `2026-02-15-reality-audit.md`).
- Findings that are already tracked in
  `../product-management/backlog.md` are cross-referenced by ID
  (EE-\*, MCA-\*), not duplicated.
- A release may not ship while the verdict is **Not Ready**.
