---
name: adr-maintenance
description: Create and maintain architecture decision records for Shinobi with clear context, tradeoffs, verification evidence, and follow-ups. Use when architectural boundaries or behavior contracts are introduced or changed.
argument-hint: "[decision title] + [affected packages] + [status]"
---

# ADR Maintenance Skill

Use this skill to keep architecture decisions durable and traceable.

## Outcomes

- Decisions are documented with context and consequences.
- Verification evidence is linked.
- Follow-up actions are clear.

## Required References

- `docs/architecture/adr-log.md`
- Relevant implementation files and tests for the decision.

## Workflow

1. Identify decision scope and affected components.
2. Draft/append ADR entry using the template in `docs/architecture/adr-log.md`.
3. Include:
   - status/date
   - context and decision
   - positive/negative consequences
   - verification evidence
4. Link files/tests that prove behavior.
5. Add follow-ups for unresolved risks.

## TDD Requirement for Decision-Bearing Code Changes

For any ADR that corresponds to code changes:

- **Red**: tests first for new expected behavior.
- **Green**: minimal implementation change.
- **Refactor**: cleanup with tests still green.

Verification evidence section must include commands/tests run.

## Quality Checklist

- ADR is decision-focused, not implementation diary.
- Tradeoffs are explicit.
- Evidence is reproducible.
- Superseded relationships are tracked.
