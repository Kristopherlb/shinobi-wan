# Contributing to Shinobi

Thanks for your interest in contributing. This guide covers setup, project
conventions, and how a change becomes a published release.

## Setup

Prerequisites: Node.js 20+, pnpm 9 (`corepack enable` is the easiest way).

```bash
git clone https://github.com/Kristopherlb/shinobi-wan.git
cd shinobi-wan
pnpm install
pnpm build
```

## Development Workflow

1. Create a feature branch from `main`.
2. Make your change. Architecture rules are enforced mechanically — see
   [CLAUDE.md](CLAUDE.md) for the package dependency graph and the
   non-negotiable invariants (determinism, stable IDs, no provider SDKs
   outside `packages/adapters/`).
3. Write tests first where practical. Each package uses Vitest
   (`pnpm nx test <project>`; project names are unscoped: `kernel`, `ir`,
   `cli`, `adapter-aws`, ...).
4. Run the full CI gate sequence locally before pushing — CI runs exactly
   this:

```bash
pnpm format:check      # prettier (fix with: pnpm format:write)
pnpm build
pnpm test
pnpm lint
pnpm conformance:check
pnpm smoke:consumer
pnpm blueprints:check
pnpm roadmap:check
pnpm rollout:dashboard:check
pnpm docs:check
```

5. Open a pull request against `main` and fill in the PR template.

## Commit Messages

Use conventional-commit-style prefixes (`feat:`, `fix:`, `docs:`, `chore:`,
`test:`, `refactor:`). This is a convention, not currently enforced by
tooling.

## Changesets and Releases

User-facing changes to any `packages/*` package need a changeset:

```bash
pnpm changeset
```

Pick the affected packages and a semver bump (these are 0.x packages — use
`patch` for fixes and `minor` for new capability). The release workflow
(`.github/workflows/release.yml`) turns merged changesets into a "Version
Packages" PR; merging that PR publishes the bumped packages to npm with
provenance.

## What to Work On

- `docs/product-management/backlog.md` — prioritized epics with IDs
  (EE-\*, MCA-\*).
- `docs/audit/` — readiness audits with remediation backlogs.
- `docs/operations/current-roadmap.md` — the canonical roadmap.

If you're unsure where a change belongs, `roles.md` describes the project's
role split (kernel, components, binders, policy, conformance, contracts) and
CLAUDE.md maps each role to the relevant skills and standards.

## Reporting Issues

Use the issue templates. For security vulnerabilities, do **not** open a
public issue — see [SECURITY.md](SECURITY.md).

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Be kind.
