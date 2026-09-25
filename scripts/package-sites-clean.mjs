import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const archive = process.argv[2];
if (!archive || !path.isAbsolute(archive)) {
  throw new Error('Pass an absolute output archive path.');
}
for (const file of ['dist/client/index.html', 'dist/server/index.js', 'dist/.openai/hosting.json']) {
  if (!existsSync(path.join(root, file))) throw new Error(`Missing Sites output: ${file}`);
}

const result = spawnSync('tar', [
  '-czf', archive, '-C', root,
  'dist/client', 'dist/server', 'dist/.openai',
], { stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`tar exited ${result.status}`);
