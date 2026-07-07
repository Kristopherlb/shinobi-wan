#!/usr/bin/env bash
# status.sh — agent-side loop dashboard. Reads the local dev score history
# (LOG.md) and prints elapsed wall-clock, per-cycle dev score history WITH
# intervals, and a DIVERGENCE flag if dev's lower CI bound has risen over
# the last M cycles while the last hub holdout check was flat/falling. The
# hub is the source of truth for holdout + divergence; this mirrors it
# locally.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
echo "== shinobi-wan golden-path loop status =="
echo "wall-clock: $(date -u +%FT%TZ)"
[ -f "$REPO/LOG.md" ] && grep -E 'Score \(dev\)|Holdout triple|DIVERGENCE' "$REPO/LOG.md" | tail -20 || echo "(no LOG.md yet)"
echo "Note: holdout score, interval, and the authoritative DIVERGENCE flag"
echo "arrive from the hub as a commit status; see check-holdout-status.sh."
