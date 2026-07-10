#!/usr/bin/env bash
# lint.sh — contamination + capacity fences for the shinobi-wan golden-path
# eval. Run by score.sh (dev) and score-holdout.sh (hub) against the
# candidate checkout BEFORE scoring. Any violation VOIDs the score (the
# caller emits VOID and nothing else). Detailed findings go to a human-side
# file OUTSIDE the candidate's read surface — naming the offending literal
# would turn this lint into a membership oracle (museum exhibit 12).
#
# Usage: lint.sh <candidate-checkout>   -> exit 0 clean, exit 3 = VOID
set -euo pipefail

CANDIDATE="$(cd "${1:?usage: lint.sh <candidate>}" && pwd)"
HARNESS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="$(cd "$HARNESS_DIR/.." && pwd)"
HUB_ROOT="$(cd "$TARGET_DIR/../.." && pwd)"
DESIGN="$HUB_ROOT/.claude/skills/lfd-design/scripts/design"
FINDINGS="${LINT_FINDINGS:-$TARGET_DIR/.lint-findings.txt}"   # human-side, hub only
# Fuzzy/structural checks scope to the product source the agent modifies;
# canary_scan still scans the WHOLE tree (a leak can hide anywhere).
SRC="$CANDIDATE/packages"
[ -d "$SRC" ] || SRC="$CANDIDATE"
: > "$FINDINGS"
VOID=0
note() { echo "$1" >> "$FINDINGS"; VOID=1; }

# 1. capacity_caps — no source file may hardcode a request->plan lookup
#    table. Reference baselines (max per file): 80 aws-type-literal lines
#    (program-generator.ts), 12 inline-manifest markers (parser tests),
#    ~30 dependsOn literals. Caps sit at ~2x baseline: growth to that scale
#    means stored responses, not code.
capacity_caps() {
  local f n
  while IFS= read -r f; do
    n=$(grep -c "'aws:\|\"aws:" "$f" 2>/dev/null || true); n=${n:-0}
    [ "$n" -gt 160 ] && note "capacity_caps: $(basename "$f") has $n aws-type literal lines (cap 160)"
    n=$(grep -c "components:" "$f" 2>/dev/null || true); n=${n:-0}
    [ "$n" -gt 25 ] && note "capacity_caps: $(basename "$f") has $n inline manifest markers (cap 25)"
    n=$(grep -c "dependsOn" "$f" 2>/dev/null || true); n=${n:-0}
    [ "$n" -gt 60 ] && note "capacity_caps: $(basename "$f") has $n dependsOn literals (cap 60)"
  done < <(find "$SRC" \( -name '*.ts' -o -name '*.js' -o -name '*.json' -o -name '*.yaml' \) \
             -not -path '*/node_modules/*' -not -path '*/dist/*' 2>/dev/null || true)
  return 0
}

# 2. canary_scan — any holdout canary in the candidate tree or its git
#    history is proof of eval access. The unique shared prefix is assembled
#    from parts so this file itself never contains the verbatim marker.
canary_scan() {
  local cp; cp="LFD-""CANARY-"
  if grep -rIlF "$cp" "$CANDIDATE" \
       --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.nx \
       --exclude-dir=dist --exclude-dir=.pnpm >/dev/null 2>&1; then
    note "canary_scan: a holdout canary prefix appears in the candidate tree"
  fi
  if git -C "$CANDIDATE" log -S "$cp" --oneline 2>/dev/null | grep -q .; then
    note "canary_scan: a canary appears in git history"
  fi
  return 0
}

# 3. ngram_overlap — near-verbatim / paraphrased answer leakage the exact
#    canary can't catch. (Contamination detection, fuzzy tier.)
#    Two measures: the shared library's jaccard-vs-union (telemetry), plus
#    a per-case CONTAINMENT check — jaccard against the union of 443 cases
#    dilutes a single leaked answer to ~0.001 and can never fire, so the
#    real fence is: for any (solution file, holdout case) pair, the share
#    of the case's 8-grams present in the file. Reference baseline max
#    containment ~0; threshold 0.5. Only runs where holdout answers exist
#    (hub side) — agent-side it degrades to canary_scan + capacity caps.
ngram_overlap() {
  if [ -f "$DESIGN/ngram-overlap.py" ]; then
    python3 "$DESIGN/ngram-overlap.py" --solution-dir "$SRC" \
      --eval-answers-dir "$TARGET_DIR/eval/holdout" --n 8 --threshold 0.5 \
      >>"$FINDINGS" 2>&1 || note "ngram_overlap: candidate overlaps holdout answers"
  fi
  if [ -d "$TARGET_DIR/eval/holdout" ]; then
    python3 - "$SRC" "$TARGET_DIR/eval/holdout" >>"$FINDINGS" 2>&1 <<'PYEOF' \
      || note "ngram_overlap: a holdout answer is contained in the candidate"
import json, os, re, sys
N, THRESH = 8, 0.5
def grams(text):
    t = re.findall(r"\w+", text.lower())
    return set(tuple(t[i:i+N]) for i in range(len(t) - N + 1))
src, hold = sys.argv[1], sys.argv[2]
cases = []
union = set()
for f in sorted(os.listdir(hold)):
    if f.endswith(".json"):
        c = json.load(open(os.path.join(hold, f)))
        g = grams(json.dumps(c.get("expected"), indent=1))
        if len(g) >= N:
            cases.append((f, g))
            union |= g
worst = 0.0
for dirpath, dirs, files in os.walk(src):
    dirs[:] = [d for d in dirs if d not in ("node_modules", "dist", ".git", ".nx")]
    for fname in files:
        if not fname.endswith((".ts", ".js", ".json", ".md", ".yaml", ".txt")):
            continue
        try:
            fg = grams(open(os.path.join(dirpath, fname), errors="ignore").read())
        except OSError:
            continue
        if not fg or not (fg & union):
            continue
        for _, cg in cases:
            worst = max(worst, len(cg & fg) / len(cg))
print(json.dumps({"max_containment": round(worst, 4), "threshold": THRESH}))
sys.exit(1 if worst > THRESH else 0)
PYEOF
  fi
  return 0
}

# 4. compressibility — a genuine solution's compressed size stays ~flat as
#    the eval grows; a lookup table tracks it (dodges grep-shaped checks).
#    The script always exits 0, so parse its verdict; history is per-target
#    (cycle 0 = the reference baseline, seeded at design time).
compressibility() {
  local out
  if [ -f "$DESIGN/compressibility.py" ]; then
    out=$(python3 "$DESIGN/compressibility.py" --solution-dir "$SRC" \
      --eval-size 443 --cycle "${CYCLE:-0}" \
      --history-file "$TARGET_DIR/.compressibility-history.jsonl" 2>&1) || true
    echo "$out" >> "$FINDINGS"
    echo "$out" | grep -q '"verdict": "FLAG"' && \
      note "compressibility: solution size tracking eval size (lookup-table signature)"
  fi
  return 0
}

# 5. diff_scope — one-variable-per-cycle: flag a cycle touching many
#    unrelated top-level packages at once. Human-side finding, not a VOID
#    (the score stays honest — the attribution is what's broken).
diff_scope() {
  local changed
  changed=$( { git -C "$CANDIDATE" diff --name-only HEAD~1 2>/dev/null || true; } \
    | awk -F/ '/^packages\//{print $2}' | sort -u | wc -l | tr -d ' ')
  changed=${changed:-0}
  [ "$changed" -gt 3 ] && echo "diff_scope: cycle touched $changed packages (>3) — attribution may be confounded" >> "$FINDINGS"
  return 0
}

# 6. test_shrink — Stage 0 requires the existing suite green; deleting or
#    gutting tests is the cheap way to fake that. Reference baseline:
#    121 test files / 1743 it-or-test blocks. Shrinkage below 90% of
#    baseline is a human-side finding (like diff_scope): legitimate
#    refactors exist, so a human judges — but silently vanishing coverage
#    never goes unrecorded.
test_shrink() {
  local files blocks
  # `|| true` inside the substitutions: under pipefail a zero-match grep
  # would otherwise abort the whole lint (VOID) instead of producing the
  # intended human-side finding (independent-audit residual #2).
  files=$( { find "$SRC" -name '*.test.ts' -not -path '*/node_modules/*' 2>/dev/null || true; } | wc -l | tr -d ' ')
  blocks=$( { grep -rhE '^\s*(it|test)\(' "$SRC" --include='*.test.ts' 2>/dev/null || true; } | wc -l | tr -d ' ')
  [ "${files:-0}" -lt 109 ] && echo "test_shrink: test files $files < 109 (90% of baseline 121)" >> "$FINDINGS"
  [ "${blocks:-0}" -lt 1569 ] && echo "test_shrink: it/test blocks $blocks < 1569 (90% of baseline 1743)" >> "$FINDINGS"
  return 0
}

capacity_caps
canary_scan
ngram_overlap
compressibility
diff_scope
test_shrink

[ "$VOID" = "1" ] && exit 3
exit 0
