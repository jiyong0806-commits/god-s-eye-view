import test from 'node:test';
import assert from 'node:assert/strict';
import { failure, cachedProvider, clearProviderCache, reply } from './providerRuntime.js';

test('Korean provider names never enter HTTP headers as invalid Unicode', async () => {
  const r = failure('한국경제 RSS', 502, '공급자 연결 실패');
  assert.equal(decodeURIComponent(r.headers.get('x-data-source')), '한국경제 RSS');
  assert.equal((await r.json()).provider, '한국경제 RSS');
  clearProviderCache();
  let calls = 0;
  for (let i = 0; i < 2; i++) {
    const cached = await cachedProvider('unicode-provider', '한국경제 RSS', 60000, async () => { calls++; return reply({ articles: [] }); });
    assert.equal(cached.status, 200);
    assert.equal(decodeURIComponent(cached.headers.get('x-data-source')), '한국경제 RSS');
    assert.deepEqual(await cached.json(), { articles: [] });
  }
  assert.equal(calls, 1);
});

test('cached responses have independent request-owned streams and headers', async () => {
  clearProviderCache();
  let calls = 0;
  const load = async () => { calls++; return reply({ rows: [1, 2] }, 200, { 'x-original': 'yes' }); };
  const first = await cachedProvider('detached-response', 'test', 60000, load);
  first.headers.set('x-original', 'changed');
  await first.body.cancel();
  const second = await cachedProvider('detached-response', 'test', 60000, load);
  const third = await cachedProvider('detached-response', 'test', 60000, load);
  assert.notEqual(first.body, second.body); assert.notEqual(second.body, third.body);
  assert.equal(second.headers.get('x-original'), 'yes');
  assert.deepEqual(await second.json(), { rows: [1, 2] });
  assert.deepEqual(await third.json(), { rows: [1, 2] }); assert.equal(calls, 1);
});
