import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  path.join(root, 'dist', 'client', 'index.html'),
  path.join(root, 'worker', 'index.js'),
  path.join(root, '.openai', 'hosting.json'),
];
for (const file of required) {
  if (!existsSync(file)) throw new Error(`Missing Sites build input: ${file}`);
}
mkdirSync(path.join(root, 'dist', 'server'), { recursive: true });
mkdirSync(path.join(root, 'dist', '.openai'), { recursive: true });
const requireVite = createRequire(import.meta.resolve('vite'));
await requireVite('esbuild').build({
  entryPoints: [path.join(root, 'worker', 'index.js')],
  outfile: path.join(root, 'dist', 'server', 'index.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
});
copyFileSync(path.join(root, '.openai', 'hosting.json'), path.join(root, 'dist', '.openai', 'hosting.json'));
