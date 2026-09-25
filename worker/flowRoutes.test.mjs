import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFlowRoutes } from './flowRoutes.js';
import { localModelChat, localModelStatus } from '../packages/god-runtime/ollama.js';

const request = (path, body, overrides = {}) => new Request(`https://example.test/api/flow/${path}`, {
  method: 'POST', headers: { origin: 'https://example.test', 'content-type': 'application/json' }, body: JSON.stringify(body), ...overrides,
});
test('validates methods, origin, JSON type and request size without contacting providers', async () => {
  const route = createFlowRoutes({ search: () => assert.fail('must not call upstream') });
  for (const [req, status] of [
    [request('search', { query: 'hello' }, { headers: { origin: 'https://elsewhere.test', 'content-type': 'application/json' } }), 403],
    [request('search', {}), 400], [request('search', null), 400], [request('search', { query: ' ' }), 400],
    [request('search', { query: 'x'.repeat(50000) }), 413],
    [request('search', {}, { body: 'invalid' }), 400],
    [request('search', {}, { headers: { origin: 'https://example.test' } }), 415],
    [new Request('https://example.test/api/flow/search'), 405],
    [request('status', {}), 405],
  ]) assert.equal((await route(req)).status, status);
});
test('search exposes actual provider response; provider errors never become success', async () => {
  const actual = { text: 'source text', sources: [{ title: 'source', url: 'https://example.org/' }], provider: 'test' };
  const route = createFlowRoutes({ search: async query => { assert.equal(query, '한국'); return actual; } });
  const response = await route(request('search', { query: '한국' }));
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), actual);
  const fail = createFlowRoutes({ search: async () => { throw new Error('Provider unreachable'); } });
  assert.equal((await fail(request('search', { query: '한국' }))).status, 502);
});
test('honors a per-instance minute window and reports Retry-After', async () => {
  let clock = 0;
  const route = createFlowRoutes({ now: () => clock, search: async () => ({ text: 'ok' }) });
  for (let i = 0; i < 12; i++) assert.equal((await route(request('search', { query: 'q' }))).status, 200);
  const denied = await route(request('search', { query: 'q' }));
  assert.equal(denied.status, 429); assert.equal(denied.headers.get('retry-after'), '60');
  clock = 60000; assert.equal((await route(request('search', { query: 'q' }))).status, 200);
});
test('public host cannot activate local model even when env is incorrectly supplied', async () => {
  const route = createFlowRoutes({ chat: () => assert.fail('local model exposed'), probe: () => assert.fail('local model probed') });
  const env = { FLOW_LOCAL_RUNTIME: '1', OLLAMA_MODEL: 'test' };
  assert.equal((await route(request('ai', { text: 'hi' }), env)).status, 503);
  const status = await (await route(new Request('https://example.test/api/flow/status'), env)).json();
  assert.equal(status.ai.configured, false);
});
test('local status requires an installed, reachable model', async () => {
  const route = createFlowRoutes({ probe: async () => ({ available: false, reason: 'offline' }) });
  const status = await (await route(new Request('http://localhost/api/flow/status'), { FLOW_LOCAL_RUNTIME: '1', OLLAMA_MODEL: 'test' })).json();
  assert.equal(status.ai.configured, false); assert.equal(status.ai.reason, 'offline');
  const available = await localModelStatus({ model: 'test', fetcher: async () => Response.json({ models: [{ name: 'test:latest' }] }) });
  assert.equal(available.available, true);
  assert.equal((await localModelStatus({ model: 'test', fetcher: async () => { throw new Error('offline'); } })).available, false);
});
test('model connector rejects remote addresses, missing data and upstream errors', async () => {
  const input = { text: 'evidence' };
  await assert.rejects(localModelChat(input, { url: 'https://external.test', model: 'test' }), /루프백/);
  await assert.rejects(localModelChat(input, { url: 'http://127.0.0.1:11434', model: 'test', fetcher: async () => Response.json({}) }), /텍스트/);
  await assert.rejects(localModelChat(input, { url: 'http://127.0.0.1:11434', model: 'test', fetcher: async () => new Response('', { status: 503 }) }), /503/);
});
