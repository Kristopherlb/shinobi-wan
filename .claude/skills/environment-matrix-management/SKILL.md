---
name: environment-matrix-management
description: Define and maintain environment behavior matrices for Shinobi (dev/staging/prod), including policy defaults, deploy gates, and promotion controls. Use when release controls or environment expectations change.
argument-hint: "[environment set] + [policy defaults] + [deploy gates]"
---

# Environment Matrix Management Skill

Use this skill to keep environment expectations precise and aligned with current platform behavior.

## Outcomes

- Environment requirements are explicit and non-ambiguous.
- Promotion flow and controls are documented.
- Policy pack defaults and deployment gates are auditable.

## Required References

- `docs/operations/environment-matrix.md`
- `docs/operations/runbook.md`
- `packages/cli/src/cli.ts`

## Workflow

1. Capture current environment policy defaults and release controls.
2. Verify command flags and behavior against CLI code.
3. Update matrix table (dev/staging/prod) with:
   - policy pack default
   - preview/apply requirements
   - test gates
   - approval requirements
4. Add promotion diagram and command matrix.
5. Record known MVP caveats that affect rollout expectations.

## TDD Gate (When Matrix Changes Require Code Behavior Changes)

- **Red**: add tests covering new policy/env routing behavior.
- **Green**: implement minimal behavior change.
- **Refactor**: preserve semantics, simplify structure.

Run:

- `pnpm nx run-many -t test --skipNxCache`

## Quality Checklist

- Matrix values match real CLI behavior.
- Promotion flow is clear and safe.
- Production requires explicit approval and preview gate.
- Environment caveats are visible and current.
