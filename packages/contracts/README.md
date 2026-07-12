# @shinobi/contracts

Base type definitions and interfaces for Shinobi V3: intents (IAM, network, config, telemetry), capability contracts, the backend-neutral adapter interface, and shared envelope types. Zero runtime dependencies.

## Install

```bash
pnpm add @shinobi/contracts
```

## Usage

```ts
import type { IamIntent, ConfigIntent, Intent } from '@shinobi/contracts';

// intents carry a type discriminator plus principal/resource/actions
declare const intent: IamIntent; // type: 'iam', principal, resource, actions
```

Every other `@shinobi/*` package depends on these types; install it directly
when writing custom binders, lowerers, or policy evaluators.

## Documentation

- [Integration guide](https://github.com/Kristopherlb/shinobi-wan/blob/main/docs/user/integration-guide.md) — embedding Shinobi in a platform
- [Support matrix](https://github.com/Kristopherlb/shinobi-wan/blob/main/docs/user/support-matrix.md) — component coverage and confidence tiers
- [Repository](https://github.com/Kristopherlb/shinobi-wan) — architecture, invariants, and development commands

## License

MIT
