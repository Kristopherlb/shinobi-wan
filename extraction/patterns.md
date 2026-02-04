## Patterns

| ID | Title | Rationale | Evidence | V3 Mapping |
|---|---|---|---|---|
| PAT-001 | Triad matrix test harness | Behavior is exercised across `commercial`, `fedramp-moderate`, `fedramp-high` contexts to detect drift and tier deltas. | `packages/components/ai-provider/__tests__/ai-provider.triad-matrix.test.ts:L17-L60`; `packages/components/openfeature-provider/__tests__/openfeature-provider.triad-matrix.test.ts:L17-L60`; `.cursor/rules/54-triad-tests.mdc:L1-L4`; `extracted-kb/test-cases/README.md:L42-L53` | Pattern: P-005 TriadMatrixBehavior |
| PAT-002 | Compliance packs as configuration | Framework-specific defaults/controls live in pack YAML and are loaded at runtime by framework key. | `config/commercial.yml:L61-L76`; `config/fedramp-moderate.yml:L15-L33`; `config/fedramp-high.yml:L15-L37`; `packages/core/src/platform/contracts/compliance/rules.ts:L109-L127` | Pattern: PolicyPackFormat (TBD) |
| PAT-003 | Action profile shorthand | Profiles provide a stable shorthand for IAM action sets, resolved per framework pack. | `packages/core/src/platform/binders/action-profiles.ts:L1-L21`; `packages/core/src/platform/binders/action-profiles.ts:L42-L72`; `config/commercial.yml:L1-L14` | Pattern: P-001 AccessLevelToActions |
| PAT-004 | Action allow-list enforcement | Allow-lists gate which actions are permitted per service prefix; error text includes allowed actions. | `config/commercial.yml:L15-L60`; `packages/core/src/platform/binders/__tests__/action-allow-lists.test.ts:L107-L166` | Pattern: IAM_Action_AllowLists (TBD) |
| PAT-005 | Framework-specific custom action policy | Custom actions are permitted/denied by framework (e.g., allow in commercial, deny in FedRAMP tiers). | `packages/core/src/platform/binders/__tests__/action-allow-lists.test.ts:L169-L199` | Pattern: CustomActionsOverride (TBD) |
| PAT-006 | Validation pipeline stages | Validation is staged (parse → schema validate → hydrate → references) to separate concerns and diagnostics. | `packages/core/src/services/pipeline.ts:L34-L73` | Pattern: ValidationPipeline (TBD) |
| PAT-007 | Capability vocab constants | A standard capability/event vocabulary is provided as constants to reduce drift across components/binders. | `packages/core/src/platform/contracts/platform-binding-trigger-spec.ts:L331-L393` | Pattern: CapabilityRegistrySeed (TBD) |
| PAT-008 | Binder matrix as registry | A central binder matrix/registry abstracts “what interactions are supported” and supports listing/querying compatibility. | `packages/core/src/platform/contracts/platform-binding-trigger-spec.ts:L309-L329` | Pattern: CompatibilityRegistry (TBD) |
| PAT-009 | Capability-specific directive schemas | Directive validation is capability-scoped (options schema + env allow-list per capability). | `packages/core/src/platform/contracts/directive-schema-validator.ts:L64-L125` | Pattern: CapabilityScopedDirectiveValidation (TBD) |
| PAT-010 | Stable error hints for binds | Validator attempts to compute suggested/available capabilities to improve remediation. | `packages/core/src/services/binding-directive-validator.ts:L115-L138` | Pattern: ExplainableDiagnostics (TBD) |
| PAT-011 | Artifact fan-out by concern | Artifacts are written as multiple files (plan, per-component plan, summary, validation, compliance) for CI consumption and audit. | `packages/core/src/platform/services/artifact-writer.ts:L24-L68` | Pattern: ArtifactFanOut (TBD) |
| PAT-012 | Canonical JSON/YAML formatting | Serializer uses stable formatting settings (indentation, line widths) to reduce diff noise. | `packages/core/src/platform/services/artifact-serializer.ts:L13-L69` | Pattern: CanonicalSerialization (TBD) |
| PAT-013 | Feature flag context projection | Component context is projected into flag evaluation context (service/environment/complianceFramework + metadata). | `packages/core/src/platform/services/feature-flags/feature-flag.service.ts:L612-L643` | Pattern: DeterministicContextLayering (TBD) |
| PAT-014 | Feature flag context merge order | Context merging is stable and last-write-wins, ensuring repeatable targeting behavior when contexts overlap. | `packages/core/src/platform/services/feature-flags/feature-flag.service.ts:L645-L665` | Pattern: DeterministicContextLayering (TBD) |
| PAT-015 | Provider config signatures | Provider/client configuration is serialized (sorted keys) to detect changes and avoid unnecessary re-registration. | `packages/core/src/platform/services/feature-flags/feature-flag.service.ts:L678-L691` | Pattern: ProviderSignatureCaching (TBD) |
| PAT-016 | Binding & trigger taxonomy guidance | Repo guidance documents binding/trigger categories, matrix validation, and least-privilege IAM generation expectations. | `.cursor/rules/20-bindings-triggers.mdc:L1-L49` | Pattern: BindingTriggerTaxonomy (TBD) |
| PAT-017 | Tagging and data classification guidance | Repo guidance defines mandatory tags and data classification expectations used for compliance posture. | `.cursor/rules/40-tagging-compliance.mdc:L3-L24` | Pattern: TaggingDataClassification (TBD) |
| PAT-018 | Drift check framing | Drift checking is framed as “desired vs actual” with manifest-first remediation suggestions (tooling boundary). | `.cursor/rules/70-drift.mdc:L1-L4` | Pattern: DriftDetectionGuidance (TBD) |

## Exit Criteria

- [ ] All config pack surfaces classified (defaults, actionProfiles, actionAllowLists).
- [ ] Feature flag evaluation patterns classified (context projection, merge order, provider signatures).
- [ ] Artifact writer/serializer “shape patterns” classified.
- [ ] Cursor-rule guidance patterns classified (bindings/triggers, tagging, drift).

## Open Questions

- None.

