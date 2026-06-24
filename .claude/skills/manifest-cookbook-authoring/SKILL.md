---
name: manifest-cookbook-authoring
description: Author and maintain practical Shinobi manifest pattern cookbooks with copy-ready YAML examples, expected resource outputs, and extension guidance. Use when adding or documenting supported deployment patterns.
argument-hint: "[pattern name] + [platforms] + [bindings]"
---

# Manifest Cookbook Authoring Skill

Use this skill to create high-signal manifest examples that are both copy-ready and behavior-accurate.

## Outcomes

- Engineers can bootstrap workloads from known-good patterns.
- Pattern docs match actual binder/adapter behavior.
- Limitations and caveats are explicit.

## Required References

- `docs/cookbook/manifest-patterns.md`
- `examples/*.yaml`
- `packages/binder/src/binders/*.ts`
- `packages/adapters/aws/src/adapter.ts`

## Workflow

1. Choose pattern (e.g., Lambda->SQS, API GW->Lambda->DynamoDB).
2. Build minimal valid manifest example.
3. Document expected resource classes and outputs.
4. Document known caveats/unsupported paths.
5. Add validation checklist for operators.

## TDD Requirement for New Pattern Support

If cookbook introduces behavior not yet supported in code:

- **Red**: add failing binder/lowerer tests.
- **Green**: implement minimal support.
- **Refactor**: simplify while preserving test behavior.

Minimum verification:

- `validate` passes for pattern manifest.
- `plan` includes expected resource classes.
- package tests pass with `--skipNxCache`.

## Quality Checklist

- YAML is syntactically valid and minimal.
- Pattern maps to real platform support.
- Expected output list is concrete, not vague.
- Caveats are explicit.
