"""manifest_yaml — deterministic block-style YAML emitter for shinobi
manifests. Pure stdlib (no pyyaml at scoring time): the eval generator and
the probe's mutation operators both re-emit manifests from the JSON
`manifest_obj` stored in each case, so mutants are byte-reproducible.

All strings are emitted double-quoted with JSON escaping (a YAML
double-quoted scalar is JSON-compatible), so arbitrary mined config values
round-trip safely through js-yaml.
"""
import json


def _scalar(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return json.dumps(v)
    return json.dumps(str(v))


def emit(obj, indent=0):
    """Emit a dict/list/scalar as block-style YAML lines (returns str)."""
    pad = "  " * indent
    if isinstance(obj, dict):
        if not obj:
            return pad + "{}\n"
        out = []
        for k, v in obj.items():
            key = json.dumps(str(k))
            if isinstance(v, dict) and v:
                out.append(f"{pad}{key}:\n{emit(v, indent + 1)}")
            elif isinstance(v, list) and v:
                out.append(f"{pad}{key}:\n{emit(v, indent + 1)}")
            elif isinstance(v, (dict, list)):
                out.append(f"{pad}{key}: {'{}' if isinstance(v, dict) else '[]'}\n")
            else:
                out.append(f"{pad}{key}: {_scalar(v)}\n")
        return "".join(out)
    if isinstance(obj, list):
        out = []
        for v in obj:
            if isinstance(v, dict) and v:
                body = emit(v, indent + 1)
                first, _, rest = body.partition("\n")
                out.append(f"{pad}- {first.strip()}\n" + (rest if rest.strip() else ""))
            elif isinstance(v, (dict, list)) and v:
                out.append(f"{pad}-\n{emit(v, indent + 1)}")
            elif isinstance(v, (dict, list)):
                out.append(f"{pad}- {'{}' if isinstance(v, dict) else '[]'}\n")
            else:
                out.append(f"{pad}- {_scalar(v)}\n")
        return "".join(out)
    return pad + _scalar(obj) + "\n"


def manifest_to_yaml(manifest):
    return emit(manifest)
