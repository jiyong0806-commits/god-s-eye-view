import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

const base = process.argv[2] || 'https://godseyeview-c6q.pages.dev';
const origin = new URL(base).origin;
const cases = [
  { name: 'map-html', path: '/', status: 200, type: /text\/html/ },
  { name: 'nosniff', path: '/', header: ['x-content-type-options', 'nosniff'] },
  { name: 'referrer-policy', path: '/', header: ['referrer-policy', 'strict-origin-when-cross-origin'] },
  { name: 'environment-file-hidden', path: '/.env', status: 404 },
  { name: 'worker-vars-hidden', path: '/.dev.vars', status: 404 },
  { name: 'package-manifest-hidden', path: '/package.json', status: 404 },
  { name: 'deployment-config-hidden', path: '/wrangler.pages.jsonc', status: 404 },
  { name: 'unknown-api-is-not-html', path: '/api/no-such-route', type: /application\/json/, notStatus: 200 },
  { name: 'flow-status-is-json', path: '/api/flow/status', status: 200, type: /application\/json/ },
  { name: 'status-method-guard', path: '/api/flow/status', method: 'POST', status: 405 },
  { name: 'search-method-guard', path: '/api/flow/search', status: 405 },
  { name: 'cross-origin-post-guard', path: '/api/flow/search', method: 'POST',
    headers: { origin: 'https://untrusted.example', 'content-type': 'application/json' }, body: '{}', status: 403 },
  { name: 'missing-origin-post-guard', path: '/api/flow/search', method: 'POST',
    headers: { 'content-type': 'application/json' }, body: '{}', status: 403 },
  { name: 'json-type-guard', path: '/api/flow/search', method: 'POST',
    headers: { origin, 'content-type': 'text/plain' }, body: '{}', status: 415 },
  { name: 'malformed-json-guard', path: '/api/flow/search', method: 'POST',
    headers: { origin, 'content-type': 'application/json' }, body: '{', status: 400 },
  { name: 'body-size-guard', path: '/api/flow/search', method: 'POST',
    headers: { origin, 'content-type': 'application/json' }, body: 'x'.repeat(40001), status: 413 },
];

const results = [];
for (const item of cases) {
  try {
    const response = await fetch(new URL(item.path, origin), {
      method: item.method || 'GET', headers: item.headers, body: item.body,
      redirect: 'manual', signal: AbortSignal.timeout(12000),
    });
    const contentType = response.headers.get('content-type') || '';
    const actualHeader = item.header ? response.headers.get(item.header[0]) : null;
    const pass = (item.status === undefined || response.status === item.status)
      && (item.notStatus === undefined || response.status !== item.notStatus)
      && (!item.type || item.type.test(contentType))
      && (!item.header || actualHeader === item.header[1]);
    const result = { name: item.name, pass, status: response.status, contentType,
      ...(item.header ? { header: actualHeader } : {}) };
    results.push(result);
    console.log(`${pass ? 'PASS' : 'FAIL'} ${item.name} ${response.status}`);
    await response.body?.cancel();
  } catch (error) {
    results.push({ name: item.name, pass: false, error: error.name });
    console.log(`FAIL ${item.name} ${error.name}`);
  }
}
mkdirSync('output', { recursive: true });
writeFileSync('output/security-smoke.json', JSON.stringify({ checkedAt: new Date().toISOString(),
  base: origin, method: 'bounded public HTTP smoke checks; not a Strix penetration test', results }, null, 2));
assert.ok(results.every(result => result.pass), 'Public security smoke checks failed');
