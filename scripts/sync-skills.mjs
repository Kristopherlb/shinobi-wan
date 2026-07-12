// Single-sources agent skills: .claude/skills/ is canonical; .cursor/skills/
// is a generated mirror. Run `node scripts/sync-skills.mjs` after editing a
// skill; `--check` fails when the mirror has drifted (used in CI).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, '.claude/skills');
const MIRRORS = [path.join(ROOT, '.cursor/skills')];
const check = process.argv.includes('--check');

function listFiles(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    // statSync follows symlinks, so a symlinked skill (e.g. one shared via
    // .agents/skills) is mirrored as real files.
    if (fs.statSync(full).isDirectory()) out.push(...listFiles(full, base));
    else out.push(path.relative(base, full));
  }
  return out.sort();
}

let drift = 0;
for (const mirror of MIRRORS) {
  const srcFiles = listFiles(SOURCE);
  const mirFiles = fs.existsSync(mirror) ? listFiles(mirror) : [];

  const srcSet = new Set(srcFiles);
  for (const f of mirFiles) {
    if (!srcSet.has(f)) {
      drift++;
      if (check) console.error(`skills drift: ${mirror}/${f} not in source`);
      else fs.rmSync(path.join(mirror, f));
    }
  }
  for (const f of srcFiles) {
    const src = path.join(SOURCE, f);
    const dst = path.join(mirror, f);
    const same =
      fs.existsSync(dst) &&
      fs.statSync(dst).isFile() &&
      fs.readFileSync(src, 'utf8') === fs.readFileSync(dst, 'utf8');
    if (!same) {
      drift++;
      if (check)
        console.error(
          `skills drift: ${path.relative(ROOT, dst)} differs from source`,
        );
      else {
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        fs.copyFileSync(src, dst);
      }
    }
  }
  // prune now-empty dirs left after removals
  if (!check && fs.existsSync(mirror)) {
    for (const entry of fs.readdirSync(mirror, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const dir = path.join(mirror, entry.name);
        if (listFiles(dir).length === 0) fs.rmSync(dir, { recursive: true });
      }
    }
  }
}

if (check && drift > 0) {
  console.error(
    `skills-check failed: ${drift} file(s) drifted. Edit .claude/skills/ (the source of truth) and run: node scripts/sync-skills.mjs`,
  );
  process.exit(1);
}
console.log(
  check
    ? 'skills-check passed: mirrors match .claude/skills.'
    : `skills synced (${drift} file(s) updated).`,
);
