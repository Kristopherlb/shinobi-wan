# Documentation Index

The `docs/` tree serves two audiences. Consumer-facing documentation is the
public surface; internal documentation is working evidence for contributors
and operators of this repository.

## Consumer-Facing (start here)

| Path                               | Purpose                                              |
| ---------------------------------- | ---------------------------------------------------- |
| `getting-started.md`               | Concepts, architecture, first run                    |
| `user/integration-guide.md`        | Embedding Shinobi as a library                       |
| `user/support-matrix.md`           | Component coverage with confidence tiers             |
| `user/cli-reference.md`            | All CLI commands and flags                           |
| `user/manifest-authoring-guide.md` | Writing and validating manifests                     |
| `cookbook/`                        | Copy-ready manifest patterns                         |
| `standards/`                       | Normative contracts (schemas, protocols, governance) |
| `architecture/adr-log.md`          | Architecture decision records                        |
| `../schemas/`                      | JSON Schemas for manifests and CLI output            |
| `../AGENTS.md`                     | Entry point for AI agents                            |

## Internal (contributor/operator working docs)

| Path                  | Purpose                                                                   |
| --------------------- | ------------------------------------------------------------------------- |
| `operations/`         | Runbooks, environment matrix, roadmap, and dated release evidence         |
| `conformance/`        | Gate registry mapping standards to mechanical enforcement                 |
| `skills/`             | Narrative agent-skill design specs (executable copies: `.claude/skills/`) |
| `audit/`              | Dated readiness/reality audits with remediation logs                      |
| `product-management/` | Backlog (EE-\*/MCA-\* epics)                                              |
| `integrations/`       | Partner-specific consumption contracts                                    |

## Quality Gate Notes

- Test coverage is collected per package (`vitest --coverage`,
  `@vitest/coverage-v8`) but thresholds are intentionally **not yet enforced
  in CI**: the suite is being rebalanced from shape-validation toward
  deploy-validation (see `audit/2026-02-15-reality-audit.md` finding 8), and a
  premature ratchet would reward the wrong tests. Enforcement is tracked in
  the readiness-audit remediation backlog.
