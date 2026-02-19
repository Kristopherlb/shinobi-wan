# Changesets

This repo uses [Changesets](https://github.com/changesets/changesets) for versioning and changelogs.

## Adding a changeset

```bash
pnpm changeset
```

Choose the packages to bump and write a short summary. The generated markdown file in `.changeset/` should be committed.

## Version (prepare release)

```bash
pnpm changeset version
```

Consumes changesets and bumps package versions, updates CHANGELOGs, and keeps workspace deps in sync.

## Tag-based release (v0.1.0+)

Releases are driven by Git tags. To cut v0.1.0:

1. Ensure all changesets are applied: `pnpm changeset version`
2. Commit version bumps and changelogs
3. Tag: `git tag v0.1.0`
4. Push tag: `git push origin v0.1.0`

GitHub Packages publish can be enabled later; for now the repo is installable via `pnpm add github:Owner/shinobi-wan#v0.1.0`.

## Scope

Versioned packages: `@shinobi/contracts`, `@shinobi/ir`, `@shinobi/kernel`.  
Internal packages (cli, binder, policy, etc.) are ignored by changesets.
