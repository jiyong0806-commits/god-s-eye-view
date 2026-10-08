import test from 'node:test';
import assert from 'node:assert/strict';
import { createSatelliteRoutes } from './satelliteRoutes.js';
import { sceneFromStac, previewPermission, validateSatelliteSearch, allowedAsset } from '../src/satelliteExplorer/model.js';
import { createSatelliteProvider } from '../src/satelliteExplorer/provider.js';

const now = Date.parse('2026-10-08T12:00:00Z');
const id = 'S2B_52SBG_20261008_0_L2A';
const asset = `https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/52/S/BG/2026/10/${id}/preview.jpg`;
// Synthetic metadata fixture is test-only; never served as a production observation.
const fixture = { id, collection: 'sentinel-2-l2a', bbox: [126, 37, 127, 38], properties: { datetime: '2026-10-08T02:00:00Z', 'eo:cloud_cover': 12 },
  assets: { thumbnail: { href: asset, type: 'image/jpeg' } } };
const query = '/api/satellite/search?bbox=126.8,37.4,127.2,37.8&start=2026-09-08&end=2026-10-08&cloud=30';
const request = (path = query, options = {}) => new Request(`https://example.test${path}`, options);

test('valid bounded search uses fixed provider and carries actual acquisition provenance', async () => {
  let called;
  const route = createSatelliteRoutes({ now: () => now, fetcher: async url => { called = new URL(url); return Response.json({ features: [fixture] }); } });
  const response = await route(request(`${query}&url=http://127.0.0.1`));
  assert.equal(response.status, 200); assert.equal(called.hostname, 'earth-search.aws.element84.com');
  assert.equal(called.searchParams.get('sortby'), '-properties.datetime');
  const scene = (await response.json()).scenes[0];
  assert.equal(scene.cloudCover, 12); assert.equal(scene.freshness, 'cached'); assert.equal(scene.retrievedAt, now);
  assert.equal(scene.acquiredAt, fixture.properties.datetime.replace('Z', '.000Z')); assert.equal(scene.sourceId, 'sentinel-2-earth-search');
});
test('invalid bounds, future periods, impossible dates and malformed ids do not fetch', async () => {
  const route = createSatelliteRoutes({ now: () => now, fetcher: () => { throw new Error('must not fetch'); } });
  for (const path of [query.replace('127.2', '180'), query.replace('2026-10-08&', '2026-10-09&'),
    query.replace('2026-09-08', '2026-02-30'), '/api/satellite/scene?id=../metadata', query.replace('cloud=30', 'cloud=')]) {
    assert.equal((await route(request(path))).status, 400);
  }
  assert.throws(() => validateSatelliteSearch({ bounds: [-181, 0, 1, 1] }, now));
});
test('empty results and absent optional metadata stay empty, not guessed', async () => {
  const route = createSatelliteRoutes({ now: () => now, fetcher: async () => Response.json({ features: [] }) });
  assert.deepEqual((await (await route(request())).json()).scenes, []);
  const scene = sceneFromStac({ ...fixture, properties: { datetime: fixture.properties.datetime }, assets: {} }, now);
  assert.equal(scene.cloudCover, null); assert.equal(scene.publishedAt, null); assert.deepEqual(scene.assets, []);
  assert.equal(sceneFromStac({ ...fixture, properties: {} }, now), null);
  assert.equal(previewPermission(scene).allowed, false);
});
test('unknown source license, unsafe assets and unsupported COG preview fail closed', () => {
  const scene = sceneFromStac(fixture, now);
  assert.equal(previewPermission({ ...scene, sourceId: 'unknown' }).allowed, false);
  assert.equal(previewPermission({ ...scene, assets: [{ id: 'visual', mediaType: 'image/tiff' }] }).allowed, false);
  for (const href of ['http://localhost/a.jpg', asset.replace('https:', 'http:'), `${asset}?redirect=1`, asset.replace('sentinel-cogs.s3.us-west-2.amazonaws.com', 'evil.test')]) assert.equal(allowedAsset(href), false);
});
test('supplier failures and 429 cooldown remain failures, not fixture success', async () => {
  let calls = 0;
  const route = createSatelliteRoutes({ now: () => now, fetcher: async () => { calls++; return new Response('', { status: 429, headers: { 'retry-after': '120' } }); } });
  assert.equal((await route(request())).status, 429); assert.equal((await route(request())).status, 429); assert.equal(calls, 1);
  const broken = createSatelliteRoutes({ fetcher: async () => { throw new TypeError('CORS or network unavailable'); }, now: () => now });
  assert.equal((await broken(request())).status, 502);
});
test('request cancellation propagates to supplier and browser provider', async () => {
  const controller = new AbortController(); controller.abort();
  let observed;
  const route = createSatelliteRoutes({ now: () => now, fetcher: async (_, options) => { observed = options.signal; options.signal.throwIfAborted(); } });
  assert.equal((await route(request(query, { signal: controller.signal }))).status, 502); assert.equal(observed.aborted, true);
  const provider = createSatelliteProvider(async (_, options) => { options.signal.throwIfAborted(); });
  await assert.rejects(() => provider.getScene(id, controller.signal), { name: 'AbortError' });
});
test('preview verifies a scene, fixed asset and JPEG bytes; HTML is rejected', async () => {
  const makeRoute = image => createSatelliteRoutes({ now: () => now, fetcher: async href => href.startsWith('https://earth-search')
    ? Response.json(fixture) : new Response(image, { headers: { 'content-type': 'image/jpeg' } }) });
  assert.equal((await makeRoute(new Uint8Array([255, 216, 255, 217]))(request(`/api/satellite/preview?id=${id}`))).status, 200);
  assert.equal((await makeRoute('<script>')(request(`/api/satellite/preview?id=${id}`))).status, 502);
});
test('Cloudflare-compatible manual redirects do not follow arbitrary hosts', async () => {
  const route = createSatelliteRoutes({ now: () => now, fetcher: async (_, options) => {
    assert.equal(options.redirect, 'manual'); return new Response(null, { status: 302, headers: { location: 'http://localhost/' } });
  } });
  assert.equal((await route(request())).status, 502);
});
