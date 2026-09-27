import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorldConnectRoutes, eventFromFeature, relateEvents, guardWorldAnswer } from './worldConnectRoutes.js';

const feature = (id = 'us-test', lon = 127, time = 1760000000000) => ({ id, geometry: { coordinates: [lon, 37, 10] }, properties: { mag: 4.1, place: 'Test location', time } });
const feed = { features: [feature(), feature('us-near', 127.1), feature('us-far', -80)] };
const route = options => createWorldConnectRoutes({ fetcher: async () => Response.json(feed), ...options });
const question = (id = 'us-test', host = 'https://example.test', extra = {}) => new Request(`${host}/api/world-connect/question`, { method: 'POST', headers: { origin: host, 'content-type': 'application/json', ...extra }, body: JSON.stringify({ id, question: '이 사건의 근거는?' }) });

test('normalization rejects invalid coordinates and source URLs cannot be forged', () => {
  assert.equal(eventFromFeature({ ...feature(), geometry: { coordinates: [127, 37] } }), null);
  const f = feature(); f.properties.url = 'javascript:evil';
  assert.match(eventFromFeature(f).source.url, /^https:\/\/earthquake.usgs.gov\//);
  assert.equal(eventFromFeature(f).confidence, null);
});
test('relations are location-only, bounded and never causal predictions', () => {
  const events = feed.features.map(eventFromFeature), links = relateEvents(events[0], events);
  assert.equal(links.length, 1); assert.equal(links[0].type, 'LOCATION'); assert.equal(links[0].confidence, null);
  assert.match(links[0].reason, /인과 또는 여진 판단이 아닙니다/);
});
test('unsupported model causality claims are replaced with source facts, not served as AI analysis', () => {
  const result = guardWorldAnswer({ text: '이 사건은 여진 관계가 없습니다.', provider: 'Ollama' }, eventFromFeature(feature()));
  assert.equal(result.mode, 'evidence-only'); assert.match(result.text, /할 수 없습니다/);
  assert.equal(result.text.includes('여진 관계가 없습니다'), false);
});
test('concurrent feed calls share one real upstream request and cache', async () => {
  let calls = 0;
  const handle = route({ fetcher: async () => { calls++; return Response.json(feed); } });
  const responses = await Promise.all([handle(new Request('https://x.test/api/world-connect/events')), handle(new Request('https://x.test/api/world-connect/analyze?id=us-test'))]);
  assert.deepEqual(responses.map(r => r.status), [200, 200]); assert.equal(calls, 1);
  await handle(new Request('https://x.test/api/world-connect/events')); assert.equal(calls, 1);
});
test('unknown events and unavailable models are explicit, never invented', async () => {
  const handle = route();
  assert.equal((await handle(new Request('https://x.test/api/world-connect/analyze?id=missing'))).status, 404);
  const result = await handle(question(), { FLOW_LOCAL_RUNTIME: '1', OLLAMA_MODEL: 'qwen3:1.7b' });
  assert.equal(result.status, 503); assert.match((await result.json()).error, /未|미연결/);
});
test('local questions receive only server-verified events, not user-supplied evidence', async () => {
  let seen;
  const handle = route({ chat: async (input, options) => { seen = { input, options }; return { text: '{"focus":"location"}', provider: 'test' }; } });
  const result = await handle(question('us-test', 'http://127.0.0.1:5182'), { FLOW_LOCAL_RUNTIME: '1', OLLAMA_MODEL: 'test' });
  assert.equal(result.status, 200); const answer = await result.json(); assert.equal(answer.state, 'source-reported');
  assert.equal(answer.mode, 'grounded-answer'); assert.match(answer.text, /Test location/);
  assert.equal(seen.options.url, 'http://127.0.0.1:11434'); assert.equal(seen.options.jsonFormat, true);
  assert.equal(seen.input.sources.length, 2);
});
test('model cannot fabricate coordinates or assert a causal answer through a forged focus', () => {
  const event = eventFromFeature(feature());
  const result = guardWorldAnswer({ text: '{"focus":"location","lat":9,"place":"southwest"}' }, event);
  assert.match(result.text, /127/); assert.equal(result.text.includes('southwest'), false);
  assert.match(guardWorldAnswer({ text: '{"focus":"summary"}' }, event, [], '여진인가?').text, /판단할 수 없습니다/);
});
test('origin, ID, question limit and provider errors fail safely', async () => {
  const handle = route();
  assert.equal((await handle(question('us-test', 'https://example.test', { origin: 'https://other.test' }))).status, 403);
  assert.equal((await handle(question('../bad'))).status, 400);
  for (let i = 0; i < 5; i++) await handle(question());
  assert.equal((await handle(question())).status, 429);
  const failed = route({ fetcher: async () => new Response('', { status: 503 }) });
  const response = await failed(new Request('https://x.test/api/world-connect/events'));
  assert.equal(response.status, 502); assert.match((await response.json()).error, /USGS HTTP 503/);
});
