import { build } from 'vite';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist/event');
await build({ root, configFile: false, publicDir: false,
  build: { outDir: output, rollupOptions: { input: path.join(root, 'event/index.html') } },
});
for (const name of ['event', 'fonts/PretendardVariable.woff2', 'fonts/fontshare/Satoshi-Variable.woff2', 'fonts/fontshare/ClashDisplay-Semibold.woff2', 'fonts/fontshare/FFL.txt', 'logo.svg']) {
  mkdirSync(path.dirname(path.join(output, name)), { recursive: true });
  cpSync(path.join(root, 'public', name), path.join(output, name), { recursive: true });
}
const html = readFileSync(path.join(output, 'event/index.html'), 'utf8')
  .replaceAll('href="/"', 'href="https://godseyeview-c6q.pages.dev/"');
writeFileSync(path.join(output, 'index.html'), html);
writeFileSync(path.join(output, 'event/index.html'), html);
writeFileSync(path.join(output, '404.html'), '<!doctype html><title>Not found</title><h1>404</h1><a href="/">Exhibition</a>');
console.log(`Standalone exhibition: ${output}`);
