# Checkpoint: Compute Blueprints — Phase 1 (BP-004)

**Date:** 2026-02-28
**Session:** Phase 1 — Serverless API → Queue → ETL → S3

---

## Progress

### Completed
- [x] Phase 0a: Lowerer generator script (`scripts/generate-lowerer.ts`)
- [x] Phase 0b: Policy rule generator script (`scripts/generate-policy-rule.ts`)
- [x] Phase 0c: Blueprint YAML template (`blueprints/_template.yaml`)
- [x] Phase 0d: Blueprint README (`blueprints/README.md`)
- [x] Phase 0f: FedRAMP audit script (`scripts/audit-fedramp.ts`)
- [x] 1a: SQS DLQ support — extended `SqsLowerer` (8 tests)
- [x] 1b: Lambda tracing + Powertools — extended `LambdaLowerer` (10 tests)
- [x] 1c: TelemetryIntentLowerer — new intent lowerer (12 tests)
- [x] 1d: IAM lowerer extensions — xray ACTION_MAP (2 tests)
- [x] 1e: 3 new policy rules — `sqs-dlq-missing`, `lambda-timeout-excessive`, `telemetry-tracing-disabled` (11 tests)
- [x] 1f: Blueprint manifest + golden test (11 tests)
- [x] Updated existing tests to accommodate new rules (rules.test.ts, golden-triad-resources.test.ts)

### Remaining
- [ ] Phase 2: Blueprint #8 — Static Site + CDN + WAF
- [ ] Phase 3: Blueprint #7 — Scheduled Batch Processing
- [ ] Phase 4: Blueprint #6 — ECS Fargate + ALB
- [ ] Phase 5: Blueprint #5 — EKS Cluster

---

## Key Learnings

1. **Node-level policy checks are a new pattern**: Existing rules only inspected intents. The 3 new compute rules inspect `snapshot.nodes` directly, introducing a `checkComputeNodes()` method alongside the existing intent-based checks. This pattern will scale for Phase 2+ rules.

2. **Telemetry intent lowerer replaced silent-skip**: The adapter previously silently skipped telemetry intents. Creating a proper `TelemetryIntentLowerer` that returns empty for unsupported types was cleaner and the existing "silently skips" test continued to pass naturally.

3. **New rules ripple through conformance tests**: Adding `telemetry-tracing-disabled` caused the `apigw-trigger` scenario in `golden-triad-resources.test.ts` to fire an additional rule (Lambda without tracing). Conformance tests caught this as expected — golden tests serve their purpose.

4. **ViolationTarget supports node targeting**: The contracts `ViolationTarget` interface supports `type: 'node' | 'edge' | 'artifact'`, so node-level violations fit naturally without contracts changes.

---

## Friction Points

| Issue | Impact | Potential Solution |
|-------|--------|-------------------|
| Hardcoded test counts in `rules.test.ts` | Test broke when adding new rules | Use dynamic assertion like `>= 7` or separate by category |
| Golden snapshot staleness | Had to run `--update` after rule changes | Consider auto-detecting snapshot drift in CI |
| `compilation.violations` vs `compilation.policy?.violations` | Initial golden test used wrong path | Add a type assertion helper to catch this at compile time |

---

## Improvement Opportunities

- [ ] **Test**: Consider a `assertRuleCatalogComplete()` helper that verifies every rule in SEVERITY_MAP has a matching RULE_CATALOG entry
- [ ] **Script**: Generator scripts currently print manual steps; could auto-modify files with AST transforms
- [ ] **Workflow**: Add a pre-commit hook that validates blueprint YAML against the manifest schema

---

## Plan Alignment (Mandatory)

- Plan drift observed: Phase 1 produced ~54 new tests (plan estimated ~46). Extra tests came from thorough edge case coverage.
- The plan called for Phase 0e (Pulumi schema research) — this was deferred since Phase 1 only extended existing resource types. Phase 2+ will need it for new resource types (CloudFront, WAF, ACM).
- Proposed plan update: None required — plan is on track.

---

## Improvements / Capabilities That Would Help Next

- [ ] **Tooling**: Automated Pulumi schema fetcher that extracts property names/types for new resource types (Phase 2 needs CloudFront, WAF, ACM, CloudFront Function)
- [ ] **Skill/Docs**: Document the node-level policy check pattern for use in Phase 2+ rules
- [ ] **Capability/Generator**: Extend `generate-lowerer.ts` to also generate Pulumi constructor mapping stubs in `pulumi-program.ts`

---

## Questions / Blockers

1. Phase 2 CloudFront + WAF association — should this be a post-lowering phase in `adapter.ts` or handled via edge intents?
2. Should the FedRAMP audit script run as part of CI, or remain a manual developer tool?

---

## Context for Next Session

- Currently working on: Phase 2 — Static Site + CDN + WAF
- Next step: Research Pulumi AWS provider docs for CloudFront, WAF v2, ACM resource schemas
- Key files: `packages/adapters/aws/src/lowerers/`, `packages/policy/src/rules.ts`, `packages/conformance/src/__tests__/`
- Open decisions: CloudFront↔WAF association pattern, CloudFront Function runtime versioning
