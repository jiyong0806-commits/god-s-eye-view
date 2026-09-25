import { cpSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const client = path.join(root, 'dist/client');
const output = path.join(root, 'dist/pages');
for (const name of ['index.html', 'app-icon.png', 'fonts/PretendardVariable.woff2',
  'media/earth-horizon.webp', '_headers']) {
  if (!existsSync(path.join(client, name))) throw new Error(`Missing built asset: ${name}`);
}
if (/src=["']\/(?:src\/|apps\/web\/)/.test(readFileSync(path.join(client, 'index.html'), 'utf8'))) {
  throw new Error('Source HTML is not deployable. Run npm run build first.');
}
cpSync(client, output, { recursive: true });
const requireVite = createRequire(import.meta.resolve('vite'));
await requireVite('esbuild').build({ entryPoints: [path.join(root, 'worker/pages.js')],
  outfile: path.join(output, '_worker.js'), bundle: true, format: 'esm', platform: 'browser', target: 'es2022' });
writeFileSync(path.join(output, '_routes.json'), JSON.stringify({ version: 1,
  include: ['/', '/map', '/map/*', '/home', '/home/*', '/api/*'], exclude: [] }));
writeFileSync(path.join(output, '404.html'), '<!doctype html><html lang="en"><meta charset="utf-8"><title>Not found</title><h1>404</h1><a href="/">GOD\'S EYE VIEW</a></html>');
function inspect(directory) {
  let count = 0;
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const name = path.join(directory, item.name);
    if (item.isDirectory()) count += inspect(name);
    else {
      if (item.name.startsWith('.env')) throw new Error('Environment file in deployment output');
      const bytes = readFileSync(name);
      if (bytes.length > 25 * 1024 * 1024) throw new Error(`Asset exceeds Pages limit: ${path.relative(output, name)}`);
      count++;
    }
  }
  return count;
}
console.log(JSON.stringify({ output, files: inspect(output), worker: true, sourceUpload: false }));
