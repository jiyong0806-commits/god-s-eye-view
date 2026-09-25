import { build } from 'vite';
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist/flow');
await build({ root, configFile: false, publicDir: false,
  define: { 'import.meta.env.VITE_MAP_URL': JSON.stringify('https://godseyeview-c6q.pages.dev/map/') },
  build: { outDir: output, rollupOptions: { input: path.join(root, 'home/index.html') } },
});
for (const name of ['app-icon.png', 'fonts/PretendardVariable.woff2', 'fonts/fontshare/Satoshi-Variable.woff2', 'media/earth-horizon.webp']) {
  mkdirSync(path.dirname(path.join(output, name)), { recursive: true });
  cpSync(path.join(root, 'public', name), path.join(output, name));
}
const requireVite = createRequire(import.meta.resolve('vite'));
await requireVite('esbuild').build({ entryPoints: [path.join(root, 'worker/flowPages.js')],
  outfile: path.join(output, '_worker.js'), bundle: true, format: 'esm', platform: 'browser', target: 'es2022' });
writeFileSync(path.join(output, '_routes.json'), JSON.stringify({ version: 1, include: ['/', '/home', '/home/*', '/api/*'], exclude: [] }));
writeFileSync(path.join(output, '404.html'), '<!doctype html><title>Not found</title><h1>404</h1><a href="/">God Flow</a>');
console.log(`Standalone God Flow: ${output}`);
