# @shinobi/policy

Compliance engine: 45 rules evaluated as data across Baseline, FedRAMP-Moderate, and FedRAMP-High packs via severity maps — no pack branching in components or binders (KL-008). Includes a manifest-declared exception model with expiry.

## Install

```bash
pnpm add @shinobi/policy
```

## Usage

```ts
import { BaselinePolicyEvaluator } from '@shinobi/policy';

const evaluator = new BaselinePolicyEvaluator();
// pass to the Kernel's evaluators array; select a pack via config.policyPack
```

## Documentation

- [Integration guide](https://github.com/Kristopherlb/shinobi-wan/blob/main/docs/user/integration-guide.md) — embedding Shinobi in a platform
- [Support matrix](https://github.com/Kristopherlb/shinobi-wan/blob/main/docs/user/support-matrix.md) — component coverage and confidence tiers
- [Repository](https://github.com/Kristopherlb/shinobi-wan) — architecture, invariants, and development commands

## License

MIT
