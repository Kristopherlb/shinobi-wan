---
name: operations-runbook
description: Create and maintain Shinobi operational runbooks for validate/plan/preview/deploy workflows, triage, and rollback posture. Use when documenting or executing release operations and environment-safe deployment steps.
argument-hint: "[environment] + [manifest path] + [deployment intent]"
---

# Operations Runbook Skill

Use this skill to produce or update operations procedures that are executable, auditable, and safe.

## Outcomes

- Operators can run `validate -> plan -> up` reliably.
- Preconditions and failure handling are explicit.
- Environment-specific risk controls are documented.

## Required Inputs

- Target environment (`development`, `staging`, `production`)
- Manifest path(s)
- Region and deployment intent (preview-only or apply)

## Workflow

1. Read:
   - `docs/operations/runbook.md`
   - `docs/operations/environment-matrix.md`
2. Confirm command path from CLI:
   - `packages/cli/src/cli.ts`
   - `packages/cli/src/commands/up.ts`
3. Document exact executable commands.
4. Add failure modes and deterministic triage steps.
5. Include post-deploy verification checklist.

## TDD Gate (When Runbook Change Requires Code/Command Changes)

Apply Red-Green-Refactor:

- **Red**: Add failing tests for changed command behavior.
- **Green**: Implement minimal code changes.
- **Refactor**: Improve without behavior drift.

Minimum verification:

- `pnpm nx run-many -t test --skipNxCache`
- `validate`, `plan`, and `up` preview commands execute for at least one example manifest.

## Quality Checklist

- Commands are copy-runnable.
- Preconditions are explicit.
- Rollback posture is stated.
- Known MVP caveats are listed.
- No mismatch between docs and current CLI flags.
