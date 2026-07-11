# Retrospective: LFD Golden-Path Optimization Run + CI/Merge Repair

**Date:** 2026-07-10
**Session Duration:** ~12h nominal LFD budget, spread across ~3 elapsed calendar days (2026-07-07 → 2026-07-10) due to inter-turn gaps; active tool-call time considerably less
**Artifacts Produced:**

- `program-generator.ts` defensive `dependsOn ?? []` fix (the one substantive product change that survived the whole run)
- Full LFD iteration log (`LOG.md`, 6 scored cycles + 2 checkpoints + final report)
- `.github/workflows/holdout-request-tag.yml` — GitHub Actions transport shim for the blocked holdout-tag-push channel, plus generalized `docs/operations/holdout-request-transport.md` writeup for reuse across other target repos
- CI repair: `pnpm/action-setup` version-pin conflict, Node 20 deprecation, `tools/project.json` (later removed once superseded), two brittle tooling-script fixes (`tools/docs-check.js`, `tools/rollout-dashboard.js`)
- Repo-wide Prettier formatting pass (twice — once under the wrong quote convention, once corrected)
- Resolution of a 265-file merge conflict against `main` after a parallel PR landed overlapping work
- PR #3 (`claude/optimization-executor-setup-wo9ywx` → `main`)

---

## What Went Well

### 1. Refusing to guess on the LFD eval boundary

Before ever running `prettier --write .`, the file list was audited first — catching that a blind repo-wide reformat would have written to 108 files inside `eval/` plus `goal.md` itself, both explicitly read-only per the LFD contract. That single check (grep the planned write-set against the protected-surface patterns before executing) prevented what would have been an unrecoverable contamination/VOID event on a scoring run.

### 2. Root-causing instead of dismissing "probably billing"

When CI kept failing after a reformat, the user's own hypothesis ("that's probably just billing, don't worry about it") was checked against actual evidence rather than accepted at face value — the job logs showed two specific, reproducible-locally parser bugs (`docs-check.js`'s quote-sensitive regex, `rollout-dashboard.js`'s unpadded-table-header string match) that a reformat had broken. Fixing the actual parsers (make them format-tolerant) instead of reverting the formatting or waiting out a nonexistent billing issue was the correct root-cause call, and was cheap once diagnosed (2 one-line regex changes).

### 3. Quantifying "what's actually mine" before a 265-file merge

Faced with a merge against `main` that conflicted on 265 files after a parallel session had independently fixed several of the same problems, the instinct to hand-resolve file-by-file was set aside in favor of first asking: what unique logic does this branch actually carry beyond duplicate-effort formatting noise? A quote- and whitespace-normalized diff against the pre-fork merge-base isolated the answer to exactly two lines (`dependsOn ?? []`). That turned a 265-file manual-conflict-resolution problem into "take theirs everywhere, then hand-apply two known lines" — much lower risk, much faster, and verifiable.

### 4. Full CI-equivalent local verification before every push

Every push to the PR branch (formatting fix, doc-tooling fix, merge resolution) was preceded by running the *exact* CI job sequence locally (install → format:check → build → test → lint → conformance:check → smoke:consumer → roadmap:check → rollout:dashboard:check → docs:check) rather than trusting a partial local check and finding out on GitHub. This caught the docs-check/rollout-dashboard regressions before they could compound.

---

## What Could Have Been Better

### 1. `git add -A` committed 196 stray build-tool temp directories into history

Early in the run (cycle 1), a routine `git add -A && git commit` swept up ~196 `tmp-*` directories that some tool in the install/build chain (likely an Nx-related probe) had written directly into the repo root instead of the OS temp directory, rather than into `$TMPDIR`. These sat in git history for several cycles before being noticed (only surfaced because they broke `prettier --check .` once `format:check` was wired up) and required a dedicated cleanup commit plus a `.gitignore` guard.

**Impact:** One full cycle spent diagnosing + one cleanup commit; ~196 junk files sat in shared PR history for multiple pushes before removal.

**Lesson:** `git add -A` is unsafe by default in this sandboxed environment specifically because tools can (and did) write scratch files into the repo root instead of the OS tmp dir. `git status` before any `git add -A`, or prefer explicit path lists, especially right after a fresh `pnpm install`/`nx build`.

### 2. Reformatted the whole repo under the wrong quote convention

The repo-wide Prettier pass was run using the `.prettierrc.json` inherited from the bootstrap branch (`singleQuote: false`), without checking whether that convention was actually still canonical. It wasn't — a parallel session's PR had already landed on `main` with `singleQuote: true` as the real standard (`fix: point format scripts at prettier, match repo quote style`). This meant the entire 527-file reformat commit was quote-inverted relative to the tree it would eventually need to merge into, and had to be effectively discarded (via "take theirs") at merge time.

**Impact:** ~1 full reformat pass (527 files) became throwaway work once merged; contributed directly to the 265-file conflict surface.

**Lesson:** Before a repo-wide formatting pass, don't just read the local `.prettierrc.json` — check whether `main` has diverged on exactly that file first (`git log --oneline -- .prettierrc.json` against `origin/main`, or just diff local vs. `origin/main`'s copy). A 10-second check would have caught this.

### 3. The holdout-request channel was silently broken for most of the run

`request-holdout-check.sh`'s tag push failed with HTTP 403 from cycle 2 onward — the session's git proxy only allows `refs/heads/claude/*`, not `refs/tags/*`. This wasn't discoverable from `goal.md`/`agent-instructions.md` in advance; it only surfaced by attempting the push. Roughly 17+ hours of the nominal 12h budget were spent with both issued holdout requests (`holdout-check-1`, `holdout-check-2`) sitting `pending`, and a GitHub Actions transport shim had to be built out-of-band to even deliver the tag.

**Impact:** Zero holdout datapoints were ever confirmed received during the scored run; the run closed on a budget-exhaustion stop condition rather than a bar-hit stop, with acceptance undetermined.

**Lesson:** For any LFD run in a remote/sandboxed Claude Code session, verify the tag-push channel works with a cheap no-op tag push *during Cycle 0*, before any scoring cycles — not after the first real holdout request fails. This is now written up generally in `docs/operations/holdout-request-transport.md` for reuse.

### 4. Brittle string/regex-based tooling scripts broke under a routine reformat

Both `tools/docs-check.js` (quote-literal regex) and `tools/rollout-dashboard.js` (unpadded-table-header string match) hardcoded assumptions about exact source formatting rather than being formatting-tolerant. Neither script was exercised by CI until this session's `tools/project.json` fix made `format:check` actually run for the first time — meaning these latent bugs had been sitting undetected in the tree indefinitely.

**Impact:** Two extra debug-and-fix cycles; masked by the fact that `format:check` had never actually executed in CI before this session (a separate, deeper finding — see IMP-041 below).

**Lesson:** Scripts that parse this repo's own markdown/TypeScript should tolerate Prettier's canonical output shape (quote style, table padding, trailing commas) by construction, not by accident of the tree's current state at write-time.

---

## The Golden Path (If It Existed)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Step 0: Cycle-0 smoke test of every external channel               │
│  - Confirm holdout tag-push actually reaches origin (no-op tag)     │
│  - Diff local .prettierrc.json against origin/main's copy           │
│  Outputs: two go/no-go signals before any scoring work begins       │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 1: Stage 0 repair (as actually done — this part went well)    │
│  Outputs: dependsOn fix, dev score 1.000, Stage 0 green              │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 2: git status BEFORE every `git add -A`, always               │
│  Outputs: no stray build artifacts ever enter history                │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 3: Pre-merge audit BEFORE reformatting, not after              │
│  - `git fetch origin main` and diff for divergence on shared         │
│    infra files (.prettierrc.json, package.json, ci.yml) FIRST        │
│  Outputs: reformat under the correct, already-canonical convention   │
└─────────────────────────────────────────────────────────────────────┘
```

**Estimated time with golden path:** the holdout-channel and quote-convention discoveries alone likely cost 2-3 extra round-trips each; a Cycle-0 smoke test and a pre-reformat divergence check would have caught both on the first pass.

---

## Recommendations

### Immediate (This Sprint)

| Action | Effort | Impact |
| --- | --- | --- |
| Add a `.gitignore` guard for stray root-level `tmp-*` artifacts repo-wide (already done on `main` via `fee8bfd`; confirm it's the canonical pattern going forward) | 5 min | Prevents recurrence of PAT-022 |
| Add a repo-root `CONTRIBUTING`/session note: "always `pnpm format:check` and diff `.prettierrc.json`/`package.json` against `origin/main` before a repo-wide reformat commit" | 10 min | Prevents PAT-023 recurrence |
| Make `tools/docs-check.js` and `tools/rollout-dashboard.js` parse via a real markdown/AST approach (or at minimum keep the whitespace/quote-tolerant regexes just landed) rather than literal string matches | 20 min | Removes a whole class of "breaks whenever Prettier runs" bugs |

### Near-Term (Next 2 Sprints)

| Action | Effort | Impact |
| --- | --- | --- |
| Land a Cycle-0 "channel smoke test" step in `agent-instructions.md` for future LFD runs: attempt a no-op holdout tag push and record the result before any scoring cycle | 15 min | Would have saved ~17h of blocked holdout requests this run |
| Reconcile `eval/dev`'s `invalid_schema` expectations with the fact that they were captured against a defective reference SHA — the eval currently punishes fixing the exact lowerer gaps `spec.md` names as legitimate Stage-0 repair targets (see LOG.md cycle 3-6 findings) | design-level, patch-mode | Removes a genuine scoring/spec contradiction, not self-patchable per `agent-instructions.md` |
| Host the generalized `holdout-request-tag.yml` as a `workflow_call` reusable workflow (per `docs/operations/holdout-request-transport.md`'s "Sharing across repositories" section) so other target repos don't need to copy-paste it | 30 min | One fix instead of N copies drifting independently |

### Strategic (Roadmap)

| Action | Effort | Impact |
| --- | --- | --- |
| Give concurrent Claude Code sessions working the same repo some visibility into each other's open branches/PRs before starting large repo-wide changes (formatting, dependency bumps) | process/tooling | Would have prevented the entire 265-file duplicate-effort merge this session had to absorb |
| Add an automated "protected-path write-set" check to any script that runs a formatter/codemod across the whole tree, so a run against `eval/`/`harness/`/`goal.md` fails loudly instead of relying on the operator to remember `.prettierignore` scoping | 1-2h | Converts a manual discipline (this session got right, but by inspection, not by tooling) into a structural guarantee |

---

## Metrics

| Metric | Value | Target | Notes |
| --- | --- | --- | --- |
| LFD scored cycles | 6 | n/a | Cycles 0-6 per LOG.md; dev saturated at 1.000 by cycle 1 |
| Holdout requests issued | 2 | ≤24 (budget) | Both `pending` at close; zero results received |
| Commits on PR branch | 23 (pre-merge) → 24 (post-merge) | n/a | Includes LFD cycles, CI repairs, and the merge-conflict resolution |
| Merge conflicts resolved | 265 files | 0 (ideal, with the golden-path pre-check) | All but 2 lines were duplicate-effort noise |
| Stray files accidentally committed | 196 | 0 | `tmp-*` dirs from `git add -A`; fully cleaned up |
| CI job sequence, final state | 100% green (10/10 checks) | 100% | install, build, test, lint, format, conformance, smoke, roadmap, rollout, docs |

---

## Key Takeaway

> **Before touching the whole tree (a reformat, a merge, a blanket `git add -A`) or an external channel (a holdout tag push), spend one cheap check confirming the assumption that action depends on — the canonical formatting convention, the current state of `origin/main`, or whether the channel is even reachable — because every real friction point this session hit was exactly one such unchecked assumption.**

---

## Plan Alignment (Mandatory)

- **Plan drift observed:** `goal.md`/`agent-instructions.md` assume the holdout tag-push channel works out of the box; it didn't, in this environment, for the entire run. `spec.md` names specific lowerer gaps as legitimate Stage-0 repair targets, but the eval's `invalid_schema` expectations (captured from a defective reference) actively penalize fixing them — a real contradiction between the spec and the scoring, not something visible until empirically tested in cycle 3-6.
- **Plan update(s) to apply next time:** Add an explicit Cycle-0 step to `agent-instructions.md`: "attempt a no-op holdout tag push and record success/failure before any scoring cycle begins." Flag the `invalid_schema`/reference-SHA contradiction to whoever owns the eval-generation pipeline, since it's a design issue in the eval, not something the executing agent can fix without contaminating results.
- **New preflight steps to add:** Before any repo-wide formatter/codemod run, diff the relevant config files (`.prettierrc.json`, `package.json`, CI workflow files) against `origin/main` first. Before `git add -A`, always run `git status` and scan for anything that doesn't look like an intentional source change.

---

## Improvements / Capabilities That Would Help Next

| Type | Proposal | Effort | Expected Impact |
| --- | --- | --- | --- |
| Tooling | A `scripts/target-repo/` "channel-check" script that does a no-op holdout tag push + poll at Cycle 0, separate from the real `request-holdout-check.sh` | 30 min | Surfaces a blocked transport in minutes instead of hours |
| Tooling | A pre-formatter guard script that fails loudly if the planned write-set intersects `eval/`, `harness/`, or `goal.md`, instead of relying on `.prettierignore` alone | 1h | Converts manual discipline into a structural guarantee |
| Skill/Docs | Extend the `holdout-request-transport.md` writeup into a reusable `workflow_call` (already scoped in the doc's "Sharing across repositories" section) | 30 min | Removes copy-paste drift risk across target repos |
| Process | Some mechanism for concurrent sessions on the same repo to see each other's open branches before starting broad, non-additive changes (formatting, dependency bumps) | process-level | Directly addresses the root cause of this session's 265-file merge |

---

## Follow-Up Actions

- [x] Update `/retrospectives/PATTERNS.md` with new patterns (PAT-022, PAT-023, PAT-024)
- [x] Add recommendations to `/retrospectives/IMPROVEMENTS.md` (IMP-038 through IMP-041)
- [x] File saved to `/retrospectives/sessions/`
- [ ] Create the Cycle-0 channel-check script (IMP-038) — not done this session; recommended as next action
- [ ] Reconcile the `invalid_schema` eval-vs-spec contradiction — patch-mode/design-level, out of scope for the executing agent per `agent-instructions.md`
