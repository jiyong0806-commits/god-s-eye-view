import test from 'node:test';
import assert from 'node:assert/strict';
import { aircraftCell, edgeAircraftSnapshot } from './aircraftSnapshot.js';
import { adsbLolToOpenSky } from './index.js';

test('aircraft cells group nearby queries and reject absent or impossible coordinates', () => {
  assert.deepEqual(aircraftCell(new URL('https://site.test/?lat=37.5004&lon=126.9999')), { lat: '37.5', lon: '127.0' });
  for (const query of ['', '?lat=&lon=0', '?lat=91&lon=0', '?lat=0&lon=181']) assert.equal(aircraftCell(new URL(`https://site.test/${query}`)), null);
});
test('edge cache shares successful snapshots without converting restrictions into success', async () => {
  const rows = new Map(); let calls = 0;
  const cache = { match: async request => rows.get(request.url)?.clone(), put: async (request, response) => rows.set(request.url, response) };
  const load = async () => { calls++; return Response.json({ time: 123, states: [] }); };
  await edgeAircraftSnapshot('cell', load, cache);
  const hit = await edgeAircraftSnapshot('cell', load, cache);
  assert.equal(calls, 1); assert.equal(hit.headers.get('x-flight-cache'), 'edge'); assert.equal((await hit.json()).time, 123);
  const limited = await edgeAircraftSnapshot('other', async () => new Response('', { status: 429 }), cache);
  assert.equal(limited.status, 429); assert.equal(rows.size, 1);
});
test('normalization rejects missing timestamps, invalid positions and stale fixes instead of inventing them', () => {
  assert.throws(() => adsbLolToOpenSky({ ac: [] }));
  const base = { hex: 'abc123', lat: 37.5, lon: 127, seen_pos: 2 };
  const result = adsbLolToOpenSky({ now: 1791456000000, ac: [base, { ...base, lat: null }, { ...base, lat: 100 }, { ...base, seen_pos: undefined }, { ...base, seen_pos: 121 }] });
  assert.equal(result.states.length, 1); assert.equal(result.states[0][3], 1791455998);
});
