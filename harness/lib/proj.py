"""proj — shared canonical projection for the shinobi-wan golden-path eval.

Used by BOTH eval-gen/generate_cases.py (to capture reference expectations)
and harness/score_core.py (to project candidate output). One implementation,
so generation-time truth and scoring-time comparison can never drift.

A "result" here is the raw stdout of one CLI invocation
(`plan <manifest> --json` or `validate <manifest> --json [--policy-pack P]`).

Projection kinds (case["check"]["kind"]):
  plan      — success => filtered exact resource set; failure => sorted error
              paths (structured-error contract; message wording unscored)
  validate  — validation + policy counters (policy-pack semantics)
  envelope  — stdout parses as JSON and carries a boolean `success`; nothing
              else. Content-agnostic: correct both before and after a lowerer
              repair, so fixing bugs is never punished. Current-main crashes
              fail it.

plan_golden filtering: only resources whose resourceType is in the case's
frozen `check.families` list are compared. Resource types invented later
(e.g. network emission, a roadmap item) are invisible to old cases; removing
or corrupting a golden resource is not.
"""
import json


def _norm(v):
    """Canonicalize embedded JSON strings (IAM policies, ECS container
    definitions, ...) so key order inside them is not part of the contract:
    the reference currently passes manifest key order through to these
    strings (a KL-001 defect the key_reorder probe surfaced), and a
    candidate that fixes serialization to canonical order must not be
    punished. A string stays a string (type changes are still detected) —
    only its internal key order is normalized."""
    if isinstance(v, str) and v[:1] in "[{":
        try:
            return json.dumps(json.loads(v), sort_keys=True,
                              separators=(",", ":"))
        except ValueError:
            return v
    if isinstance(v, dict):
        return {k: _norm(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_norm(x) for x in v]
    return v


def _canon_resource(r):
    return {
        "name": r.get("name"),
        "resourceType": r.get("resourceType"),
        "dependsOn": sorted(r.get("dependsOn") or []),
        "properties": _norm(r.get("properties")),
    }


def project(check, stdout_text):
    kind = check["kind"]
    try:
        doc = json.loads(stdout_text)
    except (ValueError, TypeError):
        return {"json_stdout": False}
    if not isinstance(doc, dict):
        return {"json_stdout": False}

    if kind == "envelope":
        return {"json_stdout": True,
                "has_success_bool": isinstance(doc.get("success"), bool)}

    if kind == "plan":
        if doc.get("success") is True:
            fams = set(check.get("families") or [])
            res = [
                _canon_resource(r)
                for r in ((doc.get("adapter") or {}).get("resources") or [])
                if not fams or r.get("resourceType") in fams
            ]
            res.sort(key=lambda r: (r["name"] or "", r["resourceType"] or ""))
            return {"success": True, "resources": res}
        paths = sorted({(e or {}).get("path", "")
                        for e in (doc.get("errors") or [])})
        return {"success": False, "error_paths": paths}

    if kind == "validate":
        v = doc.get("validation") or {}
        p = doc.get("policy") or {}
        return {
            "success": doc.get("success"),
            "valid": v.get("valid"),
            "errorCount": v.get("errorCount"),
            "warningCount": v.get("warningCount"),
            "policyPack": p.get("policyPack"),
            "compliant": p.get("compliant"),
            "violationCount": p.get("violationCount"),
        }

    raise ValueError(f"unknown check kind: {kind}")
