# @shinobi/cli

The `shinobi` CLI (validate, plan, up, destroy) and the highest-level programmatic API for embedding: parseManifest, validate, plan, up, structured envelopes, and the MCP integration wrapper. validate/plan never load provider SDKs.

## Install

```bash
pnpm add @shinobi/cli
```

## Usage

```bash
npx shinobi validate service.yaml --json
npx shinobi plan service.yaml --region us-east-1
```

```ts
import { validate, plan } from '@shinobi/cli';

const result = validate({ manifestPath: 'service.yaml' });
```

## Documentation

- [Integration guide](https://github.com/Kristopherlb/shinobi-wan/blob/main/docs/user/integration-guide.md) — embedding Shinobi in a platform
- [Support matrix](https://github.com/Kristopherlb/shinobi-wan/blob/main/docs/user/support-matrix.md) — component coverage and confidence tiers
- [Repository](https://github.com/Kristopherlb/shinobi-wan) — architecture, invariants, and development commands

## License

MIT
