# Shinobi Atlas

An interactive DevEx portal and knowledge-transfer surface for the Shinobi V3 platform.
Zero build step, zero runtime dependencies — it's static HTML/CSS/JS with the data inlined,
so it opens by double-clicking `index.html` and deploys to any static host (GitHub Pages, S3, Netlify) as-is.

## What's inside

| Surface | What it gives you |
|---|---|
| **Pipeline** | The seven-stage compilation flow (manifest → graph → kernel → binders → policy → adapter → deploy) as an interactive diagram. Click any stage to drill into what it does, which package owns it, its data flow, and the invariants it guards. |
| **Capabilities** | A searchable, filterable catalog of every deployable building block — in **human-readable names** ("Serverless Function", "Workflow Orchestrator", "Kubernetes Cluster"), never raw `aws-*` identifiers. Each card opens a product-detail page: what it provisions, its config surface, the provider resources it emits, and the blueprints that use it. |
| **Blueprints** | The reference-architecture gallery (implemented + planned), each linking to the capabilities it composes and its compliance posture. |
| **Compliance** | All policy rules with severity escalation across the three packs (Baseline → FedRAMP-Moderate → FedRAMP-High). |
| **Architecture** | The layered package map and knowledge-graph snapshot. |
| **Glossary** | The handful of terms that unlock the whole platform. |

Search (`/` to focus) spans capabilities, blueprints, and rules.

## Open it

```bash
# simplest — just open the file
open site/index.html

# or serve it (any static server works)
python3 -m http.server 4173 --directory site
# → http://localhost:4173
```

## Regenerate the data

All content is generated from the **actual source tree**, not hand-maintained. The catalogs live in
`site/data/*.json` and are bundled into `site/data.js` (the single inlined global the site reads).

```bash
node site/build-data.mjs   # re-bundles data/*.json + the knowledge graph into data.js
```

- `data/capabilities.json` — one entry per adapter lowerer (`packages/adapters/aws/src/lowerers/`)
- `data/policies.json` — the rule catalog + severity map (`packages/policy/src/`)
- `data/blueprints.json` — the blueprint catalog (`docs/blueprints/catalog.md` + `blueprints/**/*.yaml`)

The pipeline model, glossary, and layer ordering are authored in `build-data.mjs`; architecture
counts come from `.understand-anything/knowledge-graph.json`.

To refresh a catalog after the code changes, re-extract the relevant JSON (the human-readable names
and descriptions are curated, so review diffs), then re-run `build-data.mjs`.

## Files

```
site/
  index.html        # shell
  styles.css        # design system (dark, no external CSS)
  app.js            # SPA router + all views (no framework)
  data.js           # AUTO-GENERATED inlined data — do not edit by hand
  build-data.mjs    # bundler: data/*.json + knowledge graph → data.js
  data/             # source catalogs (capabilities, policies, blueprints)
```
