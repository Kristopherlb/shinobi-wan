const fs = require('fs');
const path = require('path');
const ROOT = process.cwd();

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      walk(full, out);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function isExternalLink(link) {
  return (
    link.startsWith('http://') ||
    link.startsWith('https://') ||
    link.startsWith('file://') ||
    link.startsWith('mailto:') ||
    link.startsWith('#')
  );
}

function existsLocalLink(file, link) {
  const noAnchor = link.split('#')[0];
  if (!noAnchor) return true;
  const resolved = path.resolve(path.dirname(file), noAnchor);
  return fs.existsSync(resolved);
}

function checkLinks(files) {
  const broken = [];
  const linkRegex = /\[[^\]]+\]\(([^)]+)\)/g;

  for (const file of files) {
    const content = read(file);
    let match;
    while ((match = linkRegex.exec(content)) !== null) {
      const raw = match[1].trim();
      if (raw.startsWith('`') && raw.endsWith('`')) continue;
      if (isExternalLink(raw)) continue;
      if (!existsLocalLink(file, raw)) {
        broken.push({ file: path.relative(ROOT, file), link: raw });
      }
    }
  }

  return broken;
}

function checkCliExamples(files) {
  const commands = new Set();
  const cmdRegex = /node\s+packages\/cli\/dist\/main\.js\s+([a-z-]+)\b/g;

  for (const file of files) {
    const content = read(file);
    let match;
    while ((match = cmdRegex.exec(content)) !== null) {
      commands.add(match[1]);
    }
  }

  const cliSource = read(path.join(ROOT, 'packages/cli/src/cli.ts'));
  const declared = new Set();
  const declRegex = /\.command\('([a-z-]+)'\)/g;
  let match;
  while ((match = declRegex.exec(cliSource)) !== null) {
    declared.add(match[1]);
  }

  const missing = [...commands].filter((cmd) => !declared.has(cmd));
  if (missing.length > 0) {
    throw new Error(`Docs reference unknown CLI command(s): ${missing.join(', ')}`);
  }
}

function main() {
  const files = walk(ROOT).filter((f) => {
    const rel = path.relative(ROOT, f);
    if (rel === 'README.md') return true;
    if (rel === path.join('docs', 'getting-started.md')) return true;
    if (rel.startsWith(path.join('docs', 'operations') + path.sep)) return true;
    if (rel.startsWith(path.join('docs', 'architecture') + path.sep)) return true;
    if (rel.startsWith(path.join('docs', 'cookbook') + path.sep)) return true;
    if (rel.startsWith(path.join('docs', 'audit') + path.sep)) return true;
    return false;
  });

  const broken = checkLinks(files);
  if (broken.length > 0) {
    const details = broken
      .map((b) => `- ${b.file}: ${b.link}`)
      .join('\n');
    throw new Error(`Broken local markdown links detected:\n${details}`);
  }

  checkCliExamples(files);
  console.log(`docs-check passed for ${files.length} markdown files.`);
}

main();
