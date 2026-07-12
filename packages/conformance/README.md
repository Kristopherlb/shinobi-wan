# @shinobi/conformance

Conformance test framework: golden cases per blueprint, the shared golden runner, and triad-matrix (component × binder × policy pack) coverage.

## Install

```bash
pnpm add @shinobi/conformance
```

## Usage

Used by teams extending Shinobi to prove determinism and contract
stability: define a golden case (manifest + expected graph/plan) and run it
through the golden runner in your test suite.

## Documentation

- [Integration guide](https://github.com/Kristopherlb/shinobi-wan/blob/main/docs/user/integration-guide.md) — embedding Shinobi in a platform
- [Support matrix](https://github.com/Kristopherlb/shinobi-wan/blob/main/docs/user/support-matrix.md) — component coverage and confidence tiers
- [Repository](https://github.com/Kristopherlb/shinobi-wan) — architecture, invariants, and development commands

## License

MIT
