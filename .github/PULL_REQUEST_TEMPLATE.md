# Summary

<!-- What does this change and why? Link related issues/backlog IDs. -->

## Type of change

- [ ] Bug fix
- [ ] New capability (component/binder/policy/CLI)
- [ ] Docs
- [ ] Tooling/CI
- [ ] Refactor (no behavior change)

## Checklist

- [ ] Local CI gates pass (`pnpm format:check && pnpm build && pnpm test && pnpm lint && pnpm conformance:check && pnpm docs:check`)
- [ ] Changeset added for user-facing package changes (`pnpm changeset`)
- [ ] No provider SDK imports outside `packages/adapters/`
- [ ] Outputs remain deterministic (no timestamps/UUIDs in identifiers)
- [ ] Docs updated where behavior changed

## Notes for reviewers
