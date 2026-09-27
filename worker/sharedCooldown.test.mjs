import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withSharedCooldown } from './sharedCooldown.js';

test('429 cooldown is shared across regions and military calls through D1', async () => {
  let retryAt = 0, calls = 0;
  const env = { PROVIDER_DB: { prepare(sql) { return { bind(...args) { return {
    first: async () => ({ retry_at: retryAt }), run: async () => { assert.match(sql, /MAX\(retry_at/); retryAt = Math.max(retryAt, args[1]); },
  }; } }; } } };
  const load = async () => { calls++; return new Response('', { status: 429, headers: { 'retry-after': '90' } }); };
  assert.equal((await withSharedCooldown(env, 'adsb.lol', load)).status, 429);
  const second = await withSharedCooldown(env, 'adsb.lol', load);
  assert.equal(second.status, 429); assert.equal(calls, 1); assert.ok(Number(second.headers.get('retry-after')) > 85);
  assert.match((await second.json()).error, /서버 공통/);
});

test('state DB failures do not trigger a retry storm', async () => {
  let calls = 0;
  const env = { PROVIDER_DB: { prepare() { throw new Error('database failure'); } } };
  const response = await withSharedCooldown(env, 'adsb.lol', async () => { calls++; return new Response(); });
  assert.equal(response.status, 503); assert.equal(calls, 0);
});
