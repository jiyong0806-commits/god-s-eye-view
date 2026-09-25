import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.join(root, 'output/products-2026-09-24');
if (existsSync(destination)) throw new Error('Product delivery already exists; preserve it and choose a new version.');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
function copy(relative, product, target = relative) {
  const to = path.join(destination, product, target);
  mkdirSync(path.dirname(to), { recursive: true });
  cpSync(path.join(root, relative), to, { recursive: true, filter: name =>
    !/(^|[\\/])(?:node_modules|\.expo|\.git|\.env|\.dev\.vars)(?:[\\/.]|$)/.test(name) });
}
function write(product, name, text) {
  const to = path.join(destination, product, name);
  mkdirSync(path.dirname(to), { recursive: true });
  writeFileSync(to, text);
}
function config(product, out) {
  write(product, 'source/wrangler.jsonc', JSON.stringify({ name: product, pages_build_output_dir: out, compatibility_date: '2026-09-24' }, null, 2));
}

copy('dist/pages', 'god-view', 'cloudflare-upload');
write('god-view', 'README.md', '# God View\nCloudflare upload: cloudflare-upload (built assets + API Worker).\nEditable full source is delivered separately as the God View source repository.\nProvider secrets, persistent AIS backend and provider permissions are not bundled.\n');

for (const name of ['apps/web', 'packages', 'tools', 'worker/flowRoutes.js', 'worker/flowRoutes.test.mjs', 'worker/flowPages.js', 'home', 'scripts/build-flow.mjs', 'LICENSE']) copy(name, 'god-flow', 'source/' + name);
for (const name of ['app-icon.png', 'fonts/PretendardVariable.woff2', 'fonts/fontshare', 'media/earth-horizon.webp']) copy('public/' + name, 'god-flow', 'source/public/' + name);
const dependencies = Object.fromEntries(Object.entries(pkg.dependencies).filter(([key]) => ['react', 'react-dom', '@xyflow/react', 'lucide-react', '@modelcontextprotocol/server', 'zod'].includes(key)));
write('god-flow', 'source/package.json', JSON.stringify({ name: 'plasma-god-flow', version: '0.2.0', private: true, type: 'module',
  scripts: { dev: 'vite --host 127.0.0.1', build: 'node scripts/build-flow.mjs', 'deploy:cloudflare': 'npx wrangler@4.136.3 pages deploy dist/flow', test: 'node --test packages/god-flow/graph.test.mjs worker/flowRoutes.test.mjs', mcp: 'node packages/god-mcp/server.mjs' },
  dependencies, devDependencies: { vite: pkg.devDependencies.vite } }, null, 2));
write('god-flow', 'source/vite.config.js', "import { defineConfig } from 'vite';\nimport { godFlowDevPlugin } from './apps/web/devPlugin.js';\nexport default defineConfig({ plugins: [godFlowDevPlugin()], define: { 'import.meta.env.VITE_MAP_URL': JSON.stringify('https://godseyeview-c6q.pages.dev/map/') } });\n");
copy('dist/flow', 'god-flow', 'cloudflare-upload');
config('god-flow', 'dist/flow');
write('god-flow', 'README.md', '# God Flow\nsource: editable React workflow, runtime, MCP and search code.\nRun npm ci, npm run dev or npm run build inside source.\ncloudflare-upload: standalone frontend and API Worker. Use Wrangler for Worker deployment.\nLocal AI requires Ollama with qwen3:1.7b. Public AI is intentionally unavailable until a secure model backend is configured. Browser workflow storage is local to each browser.\n');

copy('apps/mobile', 'mobile', 'source');
write('mobile', 'README.md', '# Mobile\nSeparate Expo/React Native WebView source. Opens the Cloudflare map directly.\nRun npm ci and npm start in source. npm run export checks JavaScript bundling.\nNo signed IPA/APK is included. Native builds require the platform SDK and signing credentials.\n');

for (const name of ['event', 'scripts/build-event.mjs', 'LICENSE']) copy(name, 'humanities-event', 'source/' + name);
for (const name of ['event', 'fonts/PretendardVariable.woff2', 'fonts/fontshare', 'logo.svg']) copy('public/' + name, 'humanities-event', 'source/public/' + name);
write('humanities-event', 'source/package.json', JSON.stringify({ name: 'plasma-humanities-event', version: '0.2.0', private: true, type: 'module', scripts: { dev: 'vite --host 127.0.0.1 --open /event/', build: 'node scripts/build-event.mjs' }, devDependencies: { vite: pkg.devDependencies.vite } }, null, 2));
copy('dist/event', 'humanities-event', 'cloudflare-upload');
config('humanities-event', 'dist/event');
write('humanities-event', 'README.md', '# Humanities Exhibition\nSeparate introduction and booth-map site.\nRun npm ci, npm run dev or npm run build in source. cloudflare-upload is ready for static Pages upload.\nBooth data is public/event/booths.json. No official layout has been supplied, so no booth positions are invented.\nUser-supplied media keeps its original license; verify rights before redistribution.\n');
console.log(JSON.stringify({ destination, products: ['god-view', 'god-flow', 'mobile', 'humanities-event'] }));
