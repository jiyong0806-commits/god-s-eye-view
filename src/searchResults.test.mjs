import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Cesium from 'cesium';
import { normalizeSearchResults, searchPlaces, searchAndFlyTo } from './locations.js';

const place = (name, lat, lng) => ({ formatted_address: name, types: ['school'], geometry: { location: { lat, lng } } });
test('search preserves multiple places, removes exact duplicates and invalid coordinates', () => {
  const one = place('서울역 A', 37.55, 126.97), two = place('서울역 B', 37.56, 126.98);
  assert.deepEqual(normalizeSearchResults([one, one, two, place('bad', 92, 126), {}]), [one, two]);
});
test('searching does not fly, selection uses exactly that candidate without another request', async () => {
  const previousFetch = globalThis.fetch, previousWindow = globalThis.window;
  const flights = [], viewer = { scene: { globe: null, canvas: {} }, camera: {
    flyToBoundingSphere: (sphere, options) => flights.push({ sphere, options }), cancelFlight() {}, lookAt() {}, lookAtTransform() {},
  } };
  const results = [place('A', 37.55, 126.97), place('B', 35.82, 126.83)];
  let calls = 0; globalThis.window = {};
  globalThis.fetch = async () => { calls++; return Response.json({ status: 'OK', results }); };
  try {
    assert.equal((await searchPlaces(viewer, '학교')).length, 2); assert.equal(flights.length, 0);
    const result = await searchAndFlyTo(viewer, '학교', { result: results[1], resolveBuilding: false, duration: .6 });
    assert.equal(result.label, 'B'); assert.equal(calls, 1); assert.equal(flights.length, 1);
    const p = Cesium.Cartographic.fromCartesian(flights[0].sphere.center);
    assert.ok(Math.abs(Cesium.Math.toDegrees(p.latitude) - 35.82) < .001);
  } finally { globalThis.fetch = previousFetch; globalThis.window = previousWindow; }
});
test('failed geocode reports the real HTTP status', async () => {
  const oldFetch = globalThis.fetch, oldWindow = globalThis.window; globalThis.window = {};
  globalThis.fetch = async () => new Response('', { status: 429 });
  try { await assert.rejects(searchPlaces({}, '서울'), /HTTP 429/); }
  finally { globalThis.fetch = oldFetch; globalThis.window = oldWindow; }
});
test('unverified named searches cannot silently fly and fictional coordinates are excluded', async () => {
  await assert.rejects(searchAndFlyTo({}, '아틀란티스'), /가상·미확인/);
  assert.deepEqual(normalizeSearchResults([{ ...place('Backrooms', 40, -73), locationStatus: 'fictional' }]), []);
});
