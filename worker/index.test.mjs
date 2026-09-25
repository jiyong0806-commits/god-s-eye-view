import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import worker from './index.js';
import { clearProviderCache } from './providerRuntime.js';
beforeEach(clearProviderCache);

const originalFetch = globalThis.fetch;
after(() => { globalThis.fetch = originalFetch; });

const assets = { fetch: async () => new Response('asset', { status: 200 }) };

test('aircraft route uses regional ADS-B fallback without inventing aircraft', async () => {
  const calls = [];
  globalThis.fetch = async (input) => {
    calls.push(String(input));
    if (String(input).includes('opensky-network.org/api/')) return new Response('', { status: 429 });
    return Response.json({ now: 1760000000000, ac: [{ hex: 'abc123', lat: 37.5, lon: 127, category: 'A7', seen_pos: 2 }] });
  };
  const result = await worker.fetch(new Request('https://example.test/api/opensky?lat=37.5&lon=127'), { ASSETS: assets });
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('x-flight-source'), 'adsb.lol');
  assert.match(calls[0], /\/v2\/lat\/37\.5\/lon\/127\/dist\/250/);
  assert.equal(calls.some((url) => url.includes('opensky-network.org')), false);
  const normalized = await result.json();
  assert.equal(normalized.time, 1760000000);
  assert.equal(normalized.states[0][3], 1759999998);
  assert.equal(normalized.states[0][17], 8);
});

test('regional aircraft requests share one upstream fetch and honor provider cooldown', async () => {
  const { default: isolatedWorker } = await import('./index.js?regional-cooldown-test');
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response('', { status: 429, headers: { 'retry-after': '75' } });
  };
  const request = () => new Request('https://example.test/api/opensky?lat=40.7&lon=-73.9');
  const responses = await Promise.all([
    isolatedWorker.fetch(request(), { ASSETS: assets }),
    isolatedWorker.fetch(request(), { ASSETS: assets }),
  ]);
  assert.deepEqual(responses.map((response) => response.status), [429, 429]);
  assert.equal(calls, 1);
  assert.equal(responses[0].headers.get('retry-after'), '75');
  assert.equal(responses[0].headers.get('x-flight-source'), 'adsb.lol');
  const again = await isolatedWorker.fetch(request(), { ASSETS: assets });
  assert.equal(again.status, 429);
  assert.equal(calls, 1);
});

test('unconfigured AIS route reports its missing stream backend', async () => {
  const response = await worker.fetch(new Request('https://example.test/api/ais-live'), { ASSETS: assets });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('retry-after'), '900');
  const body = await response.json();
  assert.equal(body.status, 'unsupported');
  assert.match(body.error, /persistent backend/);
});

test('public military route serves valid aircraft and coalesces requests', async () => {
  let calls = 0;
  globalThis.fetch = async (input) => {
    assert.equal(String(input), 'https://api.adsb.lol/v2/mil');
    calls += 1;
    return Response.json({ now: 1760000000, ac: [
      { hex: 'abc123', lat: 37.5, lon: 127, flight: 'TEST1' },
      { hex: 'bad', lat: null, lon: 127 },
    ] });
  };
  const url = 'https://example.test/api/adsblol/mil';
  const responses = await Promise.all([
    worker.fetch(new Request(url), { ASSETS: assets }),
    worker.fetch(new Request(url), { ASSETS: assets }),
  ]);
  assert.deepEqual(responses.map((response) => response.status), [200, 200]);
  assert.equal(calls, 1);
  const body = await responses[0].json();
  assert.equal(body.ac.length, 1);
  assert.equal(body.ac[0].hex, 'abc123');
});

test('military provider 429 enters cooldown without retrying upstream', async () => {
  const { default: isolatedWorker } = await import('./index.js?military-cooldown-test');
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response('', { status: 429, headers: { 'retry-after': '90' } });
  };
  const request = () => new Request('https://example.test/api/adsblol/mil');
  const first = await isolatedWorker.fetch(request(), { ASSETS: assets });
  const second = await isolatedWorker.fetch(request(), { ASSETS: assets });
  assert.equal(first.status, 429);
  assert.equal(second.status, 429);
  assert.equal(first.headers.get('retry-after'), '90');
  assert.equal(calls, 1);
});

test('satellite route returns real TLE text and rejects arbitrary groups', async () => {
  globalThis.fetch = async () => new Response('ISS\n1 sample\n2 sample\n');
  const good = await worker.fetch(new Request('https://example.test/api/celestrak/stations'), { ASSETS: assets });
  assert.equal(good.status, 200);
  assert.match(await good.text(), /^ISS/);
  const bad = await worker.fetch(new Request('https://example.test/api/celestrak/unknown'), { ASSETS: assets });
  assert.equal(bad.status, 400);
});

test('satellite route recovers from CelesTrak denial with credited SatNOGS TLEs', async () => {
  globalThis.fetch = async (input) => String(input).includes('celestrak.org')
    ? new Response('blocked', { status: 403 })
    : Response.json([
      { tle0: '0 ISS (ZARYA)', tle1: '1 25544U 98067A', tle2: '2 25544 51.6' },
      { tle0: '0 NOAA 19', tle1: '1 33591U 09005A', tle2: '2 33591 99.1' },
    ]);
  const response = await worker.fetch(new Request('https://example.test/api/celestrak/stations'), { ASSETS: assets });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-satellite-source'), 'SatNOGS DB');
  assert.match(await response.text(), /^ISS \(ZARYA\)\n1 25544U/);
});

test('Korean geocode request returns a usable camera destination', async () => {
  globalThis.fetch = async () => Response.json([{ lat: '37.5665', lon: '126.9780', display_name: '서울', type: 'city', boundingbox: ['37.4', '37.7', '126.8', '127.2'] }]);
  const response = await worker.fetch(new Request('https://example.test/api/geocode?q=%EC%84%9C%EC%9A%B8'), { ASSETS: assets });
  const body = await response.json();
  assert.equal(body.status, 'OK');
  assert.equal(body.results[0].geometry.location.lat, 37.5665);
});

test('unconfigured paid TTS does not call upstream', async () => {
  globalThis.fetch = async () => { throw new Error('unexpected upstream request'); };
  const response = await worker.fetch(new Request('https://example.test/api/elevenlabs/tts', { method: 'POST', body: JSON.stringify({ text: 'test' }) }), { ASSETS: assets });
  assert.equal(response.status, 503);
});

test('FIRMS requires a server key and reports its configured state', async () => {
  globalThis.fetch = async () => { throw new Error('unexpected upstream request'); };
  const missing = await worker.fetch(new Request('https://example.test/api/firms'), { ASSETS: assets });
  assert.equal(missing.status, 503);
  assert.equal((await missing.json()).error, 'no_key');
  const status = await worker.fetch(new Request('https://example.test/api/firms/status'), { ASSETS: assets, FIRMS_MAP_KEY: 'test-key' });
  assert.equal(status.status, 200);
  assert.equal((await status.json()).hasKey, true);
});

test('FIRMS returns only parsed recent detections and shares an upstream refresh', async () => {
  const { default: isolatedWorker } = await import('./index.js?firms-test');
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    const today = new Date().toISOString().slice(0, 10);
    const time = new Date().toISOString().slice(11, 16).replace(':', '');
    return new Response(`latitude,longitude,acq_date,acq_time,confidence,frp\n37.5,127,${today},${time},n,4\n0,0,2000-01-01,1200,n,9\n`);
  };
  const request = () => new Request('https://example.test/api/firms');
  const env = { ASSETS: assets, FIRMS_MAP_KEY: 'test-key' };
  const [first, second] = await Promise.all([isolatedWorker.fetch(request(), env), isolatedWorker.fetch(request(), env)]);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(calls, 1);
  const body = await first.json();
  assert.equal(body.sources.length, 1);
  assert.equal(body.count, 1);
  assert.equal(body.fires.some((fire) => fire.acqDate === '2000-01-01'), false);
  assert.equal((await isolatedWorker.fetch(request(), env)).status, 200);
  assert.equal(calls, 1);
});

test('bike-share proxy serves allowlisted GBFS data and rejects arbitrary URLs', async () => {
  const calls = [];
  globalThis.fetch = async (input) => {
    calls.push(String(input));
    return Response.json({ data: { stations: [{ station_id: '1' }] } });
  };
  const path = encodeURIComponent('https://gbfs.bluebikes.com/gbfs/en/station_information.json');
  const response = await worker.fetch(new Request(`https://example.test/api/gbfs/${path}`), { ASSETS: assets });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.stations.length, 1);
  assert.equal(calls.length, 1);
  for (const target of ['http://gbfs.bluebikes.com/gbfs/en/station_status.json', 'https://evil.example/station_status.json', 'https://gbfs.bluebikes.com/admin']) {
    const denied = await worker.fetch(new Request(`https://example.test/api/gbfs/${encodeURIComponent(target)}`), { ASSETS: assets });
    assert.equal(denied.status, 400);
  }
  assert.equal(calls.length, 1);
});

test('event QR shortcut redirects to the event page', async () => {
  const response = await worker.fetch(new Request('https://example.test/event'), { ASSETS: assets });
  assert.equal(response.status, 308);
  assert.equal(response.headers.get('location'), 'https://example.test/event/');
});
