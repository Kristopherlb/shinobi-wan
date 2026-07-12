# @shinobi/ir

Intermediate representation for the Shinobi graph: Node/Edge/DerivedArtifact types, the copy-on-write Graph with idempotent mutations, canonical ordering and serialization, stable ID generation, and semantic hashing.

## Install

```bash
pnpm add @shinobi/ir
```

## Usage

```ts
import { Graph, createNodeId } from '@shinobi/ir';

const graph = new Graph();
const id = createNodeId('component', 'orders/api'); // deterministic, no UUIDs
```

## Documentation

- [Integration guide](https://github.com/Kristopherlb/shinobi-wan/blob/main/docs/user/integration-guide.md) — embedding Shinobi in a platform
- [Support matrix](https://github.com/Kristopherlb/shinobi-wan/blob/main/docs/user/support-matrix.md) — component coverage and confidence tiers
- [Repository](https://github.com/Kristopherlb/shinobi-wan) — architecture, invariants, and development commands

## License

MIT
