import test from 'node:test';
import assert from 'node:assert/strict';
import pages from './pages.js';

test('Pages root serves the built God View map, not source or the Flow homepage', async () => {
  let assetPath;
  const response = await pages.fetch(new Request('https://example.pages.dev/'), { ASSETS: { fetch(request) {
    assetPath = new URL(request.url).pathname;
    return new Response('<html>built map</html>', { headers: { 'content-type': 'text/html' } });
  } } });
  assert.equal(assetPath, '/');
  assert.equal(response.status, 200);
});
test('map and Flow aliases avoid Pages canonical redirect loops', async () => {
  for (const [input, expected] of [['/map/', '/'], ['/home', '/home/'], ['/home/', '/home/']]) {
    const response = await pages.fetch(new Request(`https://example.pages.dev${input}`), {
      ASSETS: { fetch: async request => {
        assert.equal(new URL(request.url).pathname, expected);
        return new Response('built page');
      } },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('location'), null);
  }
});

test('Pages API status is JSON, not the SPA HTML fallback', async () => {
  const response = await pages.fetch(new Request('https://example.pages.dev/api/flow/status'), {});
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.equal((await response.json()).ai.configured, false);
});
test('missing assets cannot return successful HTML', async () => {
  const response = await pages.fetch(new Request('https://example.pages.dev/fonts/missing.woff2'), {
    ASSETS: { fetch: async () => new Response('<html>fallback</html>', { headers: { 'content-type': 'text/html' } }) },
  });
  assert.equal(response.status, 404);
});
test('real font bytes pass through unchanged', async () => {
  const bytes = new Uint8Array([119, 79, 70, 50, 0, 1]);
  const response = await pages.fetch(new Request('https://example.pages.dev/fonts/font.woff2'), {
    ASSETS: { fetch: async () => new Response(bytes, { headers: { 'content-type': 'font/woff2' } }) },
  });
  assert.equal(response.headers.get('content-type'), 'font/woff2');
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
});
