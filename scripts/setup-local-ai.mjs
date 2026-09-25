import { createHash } from 'node:crypto';
import { createWriteStream, createReadStream } from 'node:fs';
import { mkdir, stat, rename } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../.gev-cache/ollama/', import.meta.url)));
const url = 'https://github.com/ollama/ollama/releases/download/v0.34.3/ollama-windows-amd64.zip';
const expected = '306ce9e81e3491d147f558e60d7a389499f244d10f71859c6e4e899241d1b4ae';
const target = path.join(root, 'ollama-v0.34.3.zip');
await mkdir(root, { recursive: true });
const exists = await stat(target).then(s => s.isFile()).catch(() => false);
if (!exists) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20 * 60 * 1000) });
  if (!response.ok) throw new Error(`Official download HTTP ${response.status}`);
  let received = 0, reported = 0;
  await pipeline(response.body, new Transform({ transform(chunk, _, callback) {
    received += chunk.length;
    if (received - reported > 100 * 1024 * 1024) { console.log(`${Math.round(received / 1024 / 1024)} MiB downloaded`); reported = received; }
    callback(null, chunk);
  } }), createWriteStream(`${target}.part`, { flags: 'w' }));
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(`${target}.part`)) hash.update(chunk);
  if (hash.digest('hex') !== expected) throw new Error('Official release digest mismatch; archive was not activated.');
  await rename(`${target}.part`, target);
} else {
  const hash = createHash('sha256'); for await (const chunk of createReadStream(target)) hash.update(chunk);
  if (hash.digest('hex') !== expected) throw new Error('Existing archive digest mismatch.');
}
console.log(JSON.stringify({ verified: true, archive: target, version: '0.34.3' }));
