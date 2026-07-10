#!/usr/bin/env bash
# score.sh — agent-side DEV scorer (runs in the shinobi-wan repo, fast inner
# loop). Builds the CLI, runs it over eval/dev inputs (Stage 1), and compares
# projections (Stage 2), reporting an aggregate score WITH a bootstrap
# confidence interval and per-CLASS pass rates — never a per-case miss list
# (that channel fails the leak audit; see goal.md Constraints).
#
# Usage: score.sh [--holdout]
#   default    -> score eval/dev locally, print {score, ci_low, ci_high, by_class}
#   --holdout  -> DO NOT score here; request a hub holdout check (rate-limited)
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"

if [ "${1:-}" = "--holdout" ]; then
  echo "Holdout is scored by the hub only (blinded). Request via:"
  echo "  scripts/target-repo/request-holdout-check.sh <dev_score> <ci_low> <ci_high>"
  exit 0
fi

# lint first: a contamination/capacity violation VOIDs the score, no detail
if [ -f "$HERE/lint.sh" ] && ! bash "$HERE/lint.sh" "$REPO" 2>/dev/null; then
  echo "VOID: constraint violation"; exit 0
fi

cd "$REPO"
pnpm nx run-many -t build >/tmp/shinobi-dev-build.log 2>&1

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
python3 "$HERE/score_core.py" --eval-dir "$REPO/eval/dev" \
  --stage-inputs "$WORK/inputs"
bash "$HERE/stage1-run.sh" "$REPO" "$WORK/inputs" "$WORK/results" \
  >/tmp/shinobi-dev-stage1.log 2>&1

# aggregate + interval + per-class only (no per-case identity)
python3 "$HERE/score_core.py" --eval-dir "$REPO/eval/dev" \
  --results "$WORK/results" --bootstrap "${SCORE_BOOTSTRAP:-1000}" \
  --seed "${SCORE_SEED:-0}" --full
