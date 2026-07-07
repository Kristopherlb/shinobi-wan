#!/usr/bin/env python3
"""probe_core — mutation testing over the shinobi manifest input domain,
per named operator. Mutants are FRESH inputs derived from eval cases, so a
per-operator score measures whether the candidate generalizes the
manifest->plan contract or memorized the eval. Reported per operator, never
blended.

Operator table (this task's input domain):
  key_reorder     reorder mapping keys in the manifest        -> output IDENTICAL
                  (KL-001 determinism / canonical ordering; breaks any
                  dispatcher keyed on manifest text or key order)
  item_reorder    reverse components[] and bindings[] arrays  -> output IDENTICAL
                  (canonical ordering; breaks positional memorization)
  comment_noise   inject YAML comments + blank lines          -> output IDENTICAL
                  (breaks file-hash / byte-level lookup)
  service_rename  rename the service (name propagates into    -> projection equals the
                  resource names/ARNs/tags)                      expected with the same
                                                                 rename applied
  config_scale    double a lambda memorySize                  -> projection equals the
                                                                 expected with that one
                                                                 property scaled

Every mutant's prediction is derived mechanically from the case's stored
expectation; Phase 6 verifies all five operators score 1.0 on the reference
checkout before any floor is enforced.

Usage:
  probe_core.py --eval-dir DIR --checkout DIR [--per-op 10] [--full]
Output: one JSON line {"operators": {"<op>": <0..1>, ...}}
"""
import argparse
import glob
import hashlib
import json
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "lib"))
import manifest_yaml  # noqa: E402
import proj  # noqa: E402

SUFFIX = "x9q"  # rename suffix: never appears in generated vocab


# ---------------------------------------------------------------- operators
def op_key_reorder(case):
    def rev(o):
        if isinstance(o, dict):
            return {k: rev(o[k]) for k in reversed(list(o))}
        if isinstance(o, list):
            return [rev(v) for v in o]
        return o
    m = rev(case["input"]["manifest_obj"])
    return manifest_yaml.manifest_to_yaml(m), case["expected"], case["check"]


def op_item_reorder(case):
    m = json.loads(json.dumps(case["input"]["manifest_obj"]))
    m["components"] = list(reversed(m.get("components") or []))
    m["bindings"] = list(reversed(m.get("bindings") or []))
    return manifest_yaml.manifest_to_yaml(m), case["expected"], case["check"]


def op_comment_noise(case):
    lines = case["input"]["manifest_yaml"].splitlines()
    out = ["# probe: generated mutant — content unchanged", ""]
    for i, ln in enumerate(lines):
        out.append(ln)
        if i % 3 == 2:
            out.append("# noise")
    out.append("")
    return "\n".join(out) + "\n", case["expected"], case["check"]


def op_service_rename(case):
    m = json.loads(json.dumps(case["input"]["manifest_obj"]))
    old = m.get("service")
    if not isinstance(old, str) or not old:
        return None
    new = old + SUFFIX
    m["service"] = new
    expected = json.loads(
        json.dumps(case["expected"]).replace(json.dumps(old)[1:-1],
                                             json.dumps(new)[1:-1]))
    return manifest_yaml.manifest_to_yaml(m), expected, case["check"]


def op_config_scale(case):
    m = json.loads(json.dumps(case["input"]["manifest_obj"]))
    svc = m.get("service")
    for comp in m.get("components") or []:
        cfg = comp.get("config")
        if (comp.get("platform") == "aws-lambda" and isinstance(cfg, dict)
                and isinstance(cfg.get("memorySize"), int)):
            old_mem, new_mem = cfg["memorySize"], cfg["memorySize"] * 2
            cfg["memorySize"] = new_mem
            fn = f"{svc}-{comp.get('id')}"
            expected = json.loads(json.dumps(case["expected"]))
            hit = False
            for r in expected.get("resources") or []:
                props = r.get("properties") or {}
                if props.get("functionName") == fn \
                        and props.get("memorySize") == old_mem:
                    props["memorySize"] = new_mem
                    hit = True
            if not hit:
                return None
            return manifest_yaml.manifest_to_yaml(m), expected, case["check"]
    return None


OPERATORS = [
    ("key_reorder", op_key_reorder),
    ("item_reorder", op_item_reorder),
    ("comment_noise", op_comment_noise),
    ("service_rename", op_service_rename),
    ("config_scale", op_config_scale),
]


def pick_cases(cases, op_name, want):
    """Deterministic per-operator sample: order by md5(op:id)."""
    ranked = sorted(cases, key=lambda c: hashlib.md5(
        f"{op_name}:{c['id']}".encode()).hexdigest())
    return ranked[: want * 3]  # extras in case an operator skips some


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--eval-dir", required=True)
    ap.add_argument("--checkout", required=True)
    ap.add_argument("--per-op", type=int, default=10)
    ap.add_argument("--full", action="store_true")
    args = ap.parse_args()
    checkout = os.path.abspath(args.checkout)

    cases = [json.load(open(f))
             for f in sorted(glob.glob(os.path.join(args.eval_dir, "*.json")))]
    golden = [c for c in cases if c.get("class") == "plan_golden"]

    # build mutants
    mutants = []  # (op, mid, yaml_text, argv, predicted, check)
    per_op_planned = {}
    for op_name, fn in OPERATORS:
        made = 0
        for c in pick_cases(golden, op_name, args.per_op):
            if made >= args.per_op:
                break
            got = fn(c)
            if not got:
                continue
            text, predicted, check = got
            mid = f"{op_name}-{hashlib.md5(text.encode()).hexdigest()[:8]}"
            mutants.append((op_name, mid, text, c["input"]["argv"],
                            predicted, check))
            made += 1
        per_op_planned[op_name] = made

    with tempfile.TemporaryDirectory() as work:
        inputs = os.path.join(work, "inputs")
        results = os.path.join(work, "results")
        os.makedirs(inputs)
        for _, mid, text, argv, _, _ in mutants:
            with open(os.path.join(inputs, mid + ".yaml"), "w") as f:
                f.write(text)
            with open(os.path.join(inputs, mid + ".argv"), "w") as f:
                f.write("\n".join(argv) + "\n")
        subprocess.run(
            ["bash", os.path.join(HERE, "stage1-run.sh"), checkout,
             inputs, results],
            capture_output=True, timeout=int(os.environ.get(
                "PROBE_TIMEOUT", "1200")))

        scores, detail = {}, {}
        for op_name, mid, _, _, predicted, check in mutants:
            try:
                stdout = open(os.path.join(results, mid + ".out"),
                              encoding="utf-8", errors="replace").read()
            except OSError:
                stdout = ""
            try:
                ok = proj.project(check, stdout) == predicted
            except Exception:
                ok = False
            scores.setdefault(op_name, [0, 0])
            scores[op_name][0] += 1 if ok else 0
            scores[op_name][1] += 1
            detail.setdefault(op_name, []).append([mid, ok])

    out = {"operators": {op: round(v[0] / v[1], 3) if v[1] else None
                         for op, v in sorted(scores.items())}}
    if args.full:
        out["detail"] = detail
    print(json.dumps(out))


if __name__ == "__main__":
    main()
