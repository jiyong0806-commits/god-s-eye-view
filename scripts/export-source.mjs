import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, lstatSync, mkdirSync, copyFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nameIndex = process.argv.indexOf('--name');
const deliveryName = nameIndex === -1 ? 'GODS-EYE-VIEW-source' : process.argv[nameIndex + 1];
if (!deliveryName || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/.test(deliveryName)) throw new Error('Use a simple delivery folder name without path separators.');
const destinationIndex = process.argv.indexOf('--destination');
if (destinationIndex !== -1 && !process.argv[destinationIndex + 1]) throw new Error('Missing destination');
const destination = destinationIndex === -1 ? path.resolve(root, 'output/delivery', deliveryName)
  : path.resolve(root, process.argv[destinationIndex + 1]);
const outputRelative = path.relative(path.join(root, 'output'), destination);
if (!outputRelative || outputRelative.startsWith('..') || path.isAbsolute(outputRelative)) throw new Error('Destination must be inside project output.');
if (!process.argv.includes('--check') && existsSync(destination)) throw new Error('Delivery folder already exists; use --name with a new version.');
const git = process.env.GIT_EXE || 'git';
const files = [...new Set(execFileSync(git, ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, maxBuffer: 16 * 1024 * 1024 }).toString().split('\0').filter(Boolean))].sort();
const deny = /(^|\/)(\.git|node_modules|dist|output|\.gev-cache|\.gev-logs|\.expo)(\/|$)|(^|\/)\.env(?!\.example$)|(^|\/)\.dev\.vars|\.(p8|p12|pfx|jks|keystore|pem|key|log|tar\.gz|zip)$/i;
const forbiddenText = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:ghp_|github_pat_|sk_live_|sk-proj-)[A-Za-z0-9_]{20,}/;
const secretValues = [];
for (const name of [path.join(root, '.env'), process.env.GEV_CANONICAL_ENV].filter(Boolean)) {
  if (!existsSync(name)) continue;
  for (const line of readFileSync(name, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || !/(KEY|SECRET|TOKEN|PASSWORD)/i.test(match[1])) continue;
    const value = match[2].replace(/\s+#.*$/, '').replace(/^(['"])(.*)\1$/, '$2');
    if (value.length >= 12 && !/(placeholder|your_|example|replace|changeme)/i.test(value)) secretValues.push(value);
  }
}
const selected = [];
if (process.argv.includes('--check-built')) {
  const walk = directory => readdirSync(directory, { withFileTypes: true }).flatMap(item => {
    const name = path.join(directory, item.name);
    if (item.isSymbolicLink()) throw new Error('Unexpected symlink in build output');
    return item.isDirectory() ? walk(name) : [name];
  });
  const built = walk(path.join(root, 'dist/client'));
  for (const name of built) {
    const bytes = readFileSync(name);
    if (secretValues.some(value => bytes.includes(Buffer.from(value)))) {
      throw new Error(`Known credential in build: ${path.relative(root, name)}. Its value was not printed.`);
    }
  }
  console.log(JSON.stringify({ builtFilesChecked: built.length, status: 'known-credential-scan-passed' }));
}
for (const file of files) {
  if (deny.test(file) || file.startsWith('../') || path.isAbsolute(file)) continue;
  const absolute = path.join(root, file);
  if (!existsSync(absolute)) continue;
  if (lstatSync(absolute).isSymbolicLink()) throw new Error(`Review symlink before export: ${file}`);
  const bytes = readFileSync(absolute);
  if (forbiddenText.test(bytes.toString('utf8')) || secretValues.some(value => bytes.includes(Buffer.from(value)))) {
    throw new Error(`Potential credential in ${file}; export stopped without printing its value.`);
  }
  selected.push({ file, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length });
}
if (process.argv.includes('--check')) {
  console.log(JSON.stringify({ files: selected.length, knownCredentialValuesChecked: secretValues.length, status: 'scan-passed' }));
  process.exit(0);
}
mkdirSync(destination, { recursive: true });
for (const item of selected) {
  const target = path.join(destination, item.file);
  mkdirSync(path.dirname(target), { recursive: true });
  copyFileSync(path.join(root, item.file), target);
}
writeFileSync(path.join(destination, 'SOURCE-MANIFEST.json'), JSON.stringify({
  generatedAt: new Date().toISOString(), sourceCommit: execFileSync(git, ['rev-parse', 'HEAD'], { cwd: root }).toString().trim(),
  includesUncommittedWorkingTree: true, excluded: ['credentials', 'git history', 'dependencies', 'build output', 'cache'],
  note: 'Source delivery, not a backup. Assets retain their original licenses. Review media rights before public redistribution.',
  files: selected,
}, null, 2));
console.log(JSON.stringify({ destination, files: selected.length, bytes: selected.reduce((sum, file) => sum + file.bytes, 0), knownCredentialValuesChecked: secretValues.length }));
