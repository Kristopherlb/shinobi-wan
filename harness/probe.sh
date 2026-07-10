#!/usr/bin/env bash
# probe.sh — agent-side mutation probe (dev inputs). Per-operator mutation
# scores with a 0.8 floor: a falling operator means the solution is
# memorizing along that axis; the next change must REMOVE an eval-shaped
# artifact, never add one (goal.md, cycle protocol).
#
# Usage: probe.sh   -> {"operators": {...}}
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
cd "$REPO"
[ -f packages/cli/dist/main.js ] || pnpm nx run-many -t build >/tmp/shinobi-probe-build.log 2>&1
python3 "$HERE/probe_core.py" --eval-dir "$REPO/eval/dev" --checkout "$REPO" \
  --per-op "${PROBE_PER_OP:-10}"
