# Harmony Composition Patterns

This cookbook contains copy-ready patterns for composing Harmony workflows with Shinobi atomic tools.

## Pattern 1: Validate then Plan

Use when checking manifest correctness and previewing change shape.

```yaml
workflow:
  name: shinobi-validate-plan
  steps:
    - tool: golden.shinobi.validate_plan
      input:
        manifestPath: examples/lambda-sqs.yaml
        policyPack: Baseline
    - tool: golden.shinobi.plan_change
      input:
        manifestPath: examples/lambda-sqs.yaml
        region: us-east-1
        policyPack: Baseline
```

Expected behavior:

- Both calls use `operationClass=plan`.
- Response envelopes include stable metadata + policy blocks.
- `plan_change` returns deterministic resource ordering.

## Pattern 2: Read projection for dashboards

Use when presenting inventory/activity without exposing mutate operations.

```yaml
workflow:
  name: shinobi-read-only-dash
  steps:
    - tool: golden.shinobi.read_entities
      input:
        manifestPath: examples/lambda-sqs.yaml
    - tool: golden.shinobi.read_activity
      input:
        manifestPath: examples/lambda-sqs.yaml
```

Expected behavior:

- `operationClass=read`.
- Wrapper derives data from validate/plan outputs and diagnostics.
- No side effects.

## Pattern 3: Gated apply with async handle

Use after rollout gates are green and approval evidence is present.

```yaml
workflow:
  name: shinobi-approved-apply
  steps:
    - tool: golden.shinobi.plan_change
      input:
        manifestPath: examples/lambda-sqs.yaml
        region: us-east-1
    - approval:
        required: true
        evidence:
          planFingerprint: ${steps[0].output.planFingerprint}
          blastRadiusHint: low
    - tool: golden.shinobi.apply_change
      input:
        manifestPath: examples/lambda-sqs.yaml
        region: us-east-1
        mode: start
        idempotencyKey: apply-2026-02-16-001
```

Expected behavior:

- `apply_change` returns `operationId` handle metadata.
- Restricted policy requires approval.
- Mutating operations remain async-first.

## Pattern 4: Rollback fallback posture

`golden.shinobi.rollback_change` currently represents wrapper-managed compensation.

- Treat as restricted operation.
- Do not assume native Shinobi rollback semantics yet.
- Prefer re-plan + compensating apply sequence until first-class rollback contract is delivered.
