#!/usr/bin/env python3
"""score_core — Stage-2 comparer for the shinobi-wan golden-path eval.

Stage 1 (agent code) is `stage1-run.sh`: it executes the candidate CLI over
staged manifest inputs and writes raw stdout per case. This module never
runs agent code — it stages inputs (from case files that also hold the
answers, so staging happens OUTSIDE any agent surface) and compares captured
outputs to expectations via the shared projection (harness/lib/proj.py).

Deterministic scoring path, but the eval is a sample of the manifest
distribution, so a case-level bootstrap always runs to quantify
eval-sampling noise (SKILL Phase 5).

Usage:
  score_core.py --eval-dir DIR --stage-inputs OUTDIR
      write <id>.yaml + <id>.argv (inputs ONLY — no expectations) and exit
  score_core.py --eval-dir DIR --results DIR [--bootstrap 1000] [--seed 0]
                [--full]
      compare Stage-1 outputs; print one JSON line {score, ci_low, ci_high, n}
      (--full adds per-class rates: hub-side / dev-side detail, never per-case)
"""
import argparse
import glob
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
import proj  # noqa: E402


def load_cases(eval_dir):
    return [json.load(open(f))
            for f in sorted(glob.glob(os.path.join(eval_dir, "*.json")))]


def stage_inputs(cases, outdir):
    os.makedirs(outdir, exist_ok=True)
    for c in cases:
        with open(os.path.join(outdir, c["id"] + ".yaml"), "w") as f:
            f.write(c["input"]["manifest_yaml"])
        with open(os.path.join(outdir, c["id"] + ".argv"), "w") as f:
            f.write("\n".join(c["input"]["argv"]) + "\n")


def score_case(case, results_dir):
    out_path = os.path.join(results_dir, case["id"] + ".out")
    try:
        stdout = open(out_path, encoding="utf-8", errors="replace").read()
    except OSError:
        stdout = ""
    try:
        live = proj.project(case["check"], stdout)
    except Exception:
        return False
    return live == case["expected"]


def bootstrap_ci(outcomes, n_resamples, seed):
    """Deterministic bootstrap (fixed LCG) — reproducible run-to-run."""
    k = len(outcomes)
    if k == 0:
        return 0.0, 0.0, 0.0
    point = sum(outcomes) / k
    state = (seed * 2654435761 + 1) & 0xFFFFFFFF
    means = []
    for _ in range(n_resamples):
        s = 0
        for _ in range(k):
            state = (1103515245 * state + 12345) & 0x7FFFFFFF
            s += outcomes[state % k]
        means.append(s / k)
    means.sort()
    lo = means[int(0.025 * n_resamples)]
    hi = means[min(int(0.975 * n_resamples), n_resamples - 1)]
    return point, lo, hi


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--eval-dir", required=True)
    p.add_argument("--stage-inputs")
    p.add_argument("--results")
    p.add_argument("--bootstrap", type=int, default=1000)
    p.add_argument("--seed", type=int, default=0)
    p.add_argument("--full", action="store_true")
    args = p.parse_args()

    cases = load_cases(args.eval_dir)
    if args.stage_inputs:
        stage_inputs(cases, args.stage_inputs)
        return
    if not args.results:
        sys.exit("need --stage-inputs or --results")

    outcomes, by_class = [], {}
    for c in cases:
        ok = score_case(c, args.results)
        outcomes.append(1 if ok else 0)
        cls = c.get("class", "?")
        by_class.setdefault(cls, [0, 0])
        by_class[cls][0] += 1 if ok else 0
        by_class[cls][1] += 1

    point, lo, hi = bootstrap_ci(outcomes, args.bootstrap, args.seed)
    # 3-decimal reporting is a leak fence, not cosmetics: the CI bounds are
    # a deterministic function of the outcome vector, and coarser rounding
    # caps the bits a holdout response can carry (independent-audit rec).
    out = {"score": round(point, 3), "ci_low": round(lo, 3),
           "ci_high": round(hi, 3), "n": len(outcomes)}
    if args.full:
        out["by_class"] = {c: {"pass": v[0], "n": v[1],
                               "rate": round(v[0] / v[1], 3) if v[1] else None}
                           for c, v in sorted(by_class.items())}
    print(json.dumps(out))


if __name__ == "__main__":
    main()
