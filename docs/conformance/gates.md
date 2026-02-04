# Conformance Gates Registry

Authoritative map from Stage 3 normative standards to Stage 4 enforcement.

## Gate Taxonomy
- **SCHEMA**: JSON Schema validation.
- **GOLDEN**: Golden file snapshot comparison.
- **LINT**: Static analysis rule.
- **DETERMINISM**: Deterministic execution check.
- **COMPAT**: Compatibility matrix check.

## Registry

| Gate ID | Standard Ref | Type | Description |
|---|---|---|---|
| G-001 | S1, S13 | SCHEMA | Graph IR validates against schema |
| G-002 | S1, S13 | DETERMINISM | Graph serialization is deterministic |
| G-003 | S1 | GOLDEN | Invalid graph structure rejected |
| G-004 | S2 | SCHEMA | Component manifest validates against schema |
| G-005 | S2 | LINT | Component defines required capabilities |
| G-020 | S3 | COMPAT | Binder declares compatibility matrix |
| G-021 | S3 | SCHEMA | Binder inputs match directive schema |
| G-022 | S3 | DETERMINISM | Binder output is deterministic |
| G-023 | S3 | GOLDEN | Binder emits required artifacts |
| G-040 | S4 | GOLDEN | Policy violation detected and reported |
| G-041 | S4 | SCHEMA | Compliance status block presence |
| G-042 | S8 | SCHEMA | Audit record format validation |
