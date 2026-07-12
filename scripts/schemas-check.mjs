// Validates every example and blueprint manifest against
// schemas/manifest.schema.json, and sanity-checks that all schemas parse.
// Run via: pnpm schemas:check
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const ROOT = process.cwd();
const schemaDir = path.join(ROOT, 'schemas');

const ajv = new Ajv2020.default({ allErrors: true, allowUnionTypes: true });
addFormats.default(ajv);

// All schemas must compile.
const schemas = {};
for (const file of fs
  .readdirSync(schemaDir)
  .filter((f) => f.endsWith('.json'))) {
  const schema = JSON.parse(
    fs.readFileSync(path.join(schemaDir, file), 'utf8'),
  );
  schemas[file] = ajv.compile(schema);
}

const validateManifest = schemas['manifest.schema.json'];
if (!validateManifest) {
  console.error('schemas-check: schemas/manifest.schema.json missing');
  process.exit(1);
}

function* manifestFiles() {
  for (const f of fs.readdirSync(path.join(ROOT, 'examples'))) {
    if (f.endsWith('.yaml')) yield path.join('examples', f);
  }
  const walk = (dir) => {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...walk(full));
      else if (entry.name.endsWith('.yaml') && !entry.name.startsWith('_'))
        out.push(full);
    }
    return out;
  };
  for (const f of walk(path.join(ROOT, 'blueprints')))
    yield path.relative(ROOT, f);
}

let failures = 0;
let checked = 0;
for (const rel of manifestFiles()) {
  const doc = parseYaml(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  checked++;
  if (!validateManifest(doc)) {
    failures++;
    console.error(`schemas-check FAIL: ${rel}`);
    for (const err of validateManifest.errors ?? []) {
      console.error(`  ${err.instancePath || '/'} ${err.message}`);
    }
  }
}

if (failures > 0) {
  console.error(
    `schemas-check failed: ${failures}/${checked} manifests invalid.`,
  );
  process.exit(1);
}
console.log(
  `schemas-check passed: ${checked} manifests valid against manifest.schema.json (${Object.keys(schemas).length} schemas compiled).`,
);
