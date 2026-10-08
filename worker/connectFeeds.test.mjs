import test from 'node:test';
import assert from 'node:assert/strict';
import { newsFromRss, currentEarthquakes, connectFeeds } from './connectFeeds.js';
import { clearProviderCache } from './providerRuntime.js';

const now = Date.parse('2026-09-27T03:00:00Z');
test('economic headlines require official links and current publication dates', () => {
  const rss = `<rss><channel><item><title>Economy</title><link>https://www.hankyung.com/article/123</link><pubDate>${new Date(now).toUTCString()}</pubDate></item><item><title>Bad</title><link>https://evil.example/article/123</link><pubDate>${new Date(now).toUTCString()}</pubDate></item></channel></rss>`;
  const rows = newsFromRss(rss, now);
  assert.equal(rows.length, 1); assert.equal(rows[0].image, null);
  assert.equal(newsFromRss(rss, now + 8 * 86400000).length, 0);
  assert.throws(() => newsFromRss('<!DOCTYPE rss><rss/>', now));
});
test('earthquake alerts omit old, future and malformed observations', () => {
  const event = { id: 'us123', properties: { mag: 2.6, time: now, place: 'test' }, geometry: { coordinates: [126, 36] } };
  assert.equal(currentEarthquakes({ features: [event] }, now).length, 1);
  assert.equal(currentEarthquakes({ features: [event] }, now + 2 * 86400000).length, 0);
  assert.equal(currentEarthquakes({ features: [{ ...event, geometry: { coordinates: [500, 36] } }] }, now).length, 0);
});
test('account configuration never publishes secret-format values', async () => {
  const url = new URL('https://site.example/api/account/config');
  const request = new Request(url);
  const invalid = await (await connectFeeds(request, { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_secret_not_public' }, url)).json();
  assert.deepEqual(invalid, { configured: false, url: null, publishableKey: null });
  const valid = await (await connectFeeds(request, { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example' }, url)).json();
  assert.equal(valid.configured, true);
});

test('news questions resolve IDs from the official cached feed and reject caller-controlled sources', async () => {
  clearProviderCache(); const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async url => {
    calls++; assert.equal(String(url), 'https://www.hankyung.com/feed/economy');
    return new Response(`<rss><channel><item><title>서울 경제</title><link>https://www.hankyung.com/article/123</link><pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`);
  };
  const url = new URL('https://site.test/api/world-connect/news-question');
  const request = body => new Request(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  try {
    const good = await connectFeeds(request({ id: '123', question: '출처?', url: 'http://localhost/secret' }), {}, url);
    assert.equal(good.status, 200); assert.equal((await good.json()).generatedByAI, false);
    assert.equal((await connectFeeds(request({ id: '123', question: '왜?' }), {}, url)).status, 200);
    assert.equal(calls, 1);
    assert.equal((await connectFeeds(request({ id: 'other', question: '내용?' }), {}, url)).status, 400);
    assert.equal((await connectFeeds(request({ id: '456', question: '내용?' }), {}, url)).status, 404);
    assert.equal((await connectFeeds(request({ id: '123', question: 'a'.repeat(5000) }), {}, url)).status, 413);
  } finally { globalThis.fetch = original; clearProviderCache(); }
});
