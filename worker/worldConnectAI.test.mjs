import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cloudWorldQuestion, sourceQuestionFocus, WORLD_AI_MODEL } from './worldConnectAI.js';
import { createWorldConnectRoutes, eventFromFeature } from './worldConnectRoutes.js';

function environment({ count = 0, dbFailure = false, response = '{"focus":"magnitude"}' } = {}) {
  const calls = [], reservations = [];
  const env = { GEV_WORLD_AI_ENABLED: '1', GEV_WORLD_AI_FREE_CONFIRMED: '1', WORLD_AI_DAILY_BUDGET: '500',
    AI: { async run(model, input) { calls.push({ model, input }); return { response }; } },
    PROVIDER_DB: { prepare(sql) { assert.match(sql, /WHERE count < \?/); return {
      bind(...args) { reservations.push(args); return { async first() {
        if (dbFailure) throw new Error('private database error');
        return count < args[3] ? { count: ++count } : null;
      } }; },
    }; } },
  };
  return { env, calls, reservations };
}

test('public AI requires explicit free-plan confirmation, binding and persistent budget', async () => {
  const { env, calls } = environment();
  for (const altered of [{ ...env, GEV_WORLD_AI_ENABLED: '0' }, { ...env, GEV_WORLD_AI_FREE_CONFIRMED: '0' },
    { ...env, AI: undefined }, { ...env, PROVIDER_DB: undefined }]) {
    await assert.rejects(cloudWorldQuestion(altered, '규모는?'), error => error.status === 503);
  }
  assert.equal(calls.length, 0);
});

test('atomic daily budget clamps to 50 across route instances and resets by UTC day', async () => {
  const { env, calls, reservations } = environment({ count: 49 });
  const time = Date.parse('2026-09-27T23:59:50Z');
  const results = await Promise.allSettled(Array.from({ length: 5 }, () => cloudWorldQuestion(env, '규모는?', { now: () => time })));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(calls.length, 1);
  for (const result of results.filter(r => r.status === 'rejected')) {
    assert.equal(result.reason.status, 429); assert.equal(result.reason.retryAfterSeconds, 10);
  }
  assert.deepEqual(reservations[0], ['world-connect-ai', '2026-09-27', 'global', 50]);
  assert.equal(calls[0].model, WORLD_AI_MODEL); assert.equal(calls[0].input.max_tokens, 64);
});

test('database failure blocks model call without leaking its internal error', async () => {
  const { env, calls } = environment({ dbFailure: true });
  await assert.rejects(cloudWorldQuestion(env, '위치는?'), error => error.code === 'ai-budget-unavailable' && !error.message.includes('private'));
  assert.equal(calls.length, 0);
});

test('non-AI focus handles Korean questions without substituting magnitude for intensity', () => {
  assert.equal(sourceQuestionFocus('규모는?'), 'magnitude');
  assert.equal(sourceQuestionFocus('진도는?'), 'unknown');
  assert.equal(sourceQuestionFocus('피해가 얼마나 커?'), 'unknown');
  assert.equal(sourceQuestionFocus('출처 알려줘'), 'sources');
  assert.equal(sourceQuestionFocus('깊이가 몇 km야?'), 'depth');
});

test('non-earthquake events cannot be presented as earthquakes', () => {
  const feature = { id: 'us-test', geometry: { coordinates: [127, 37, 10] }, properties: { type: 'quarry blast', mag: 3, time: Date.now() } };
  assert.equal(eventFromFeature(feature), null);
});

test('public AI is guarded against fabricated facts; quota failure still serves verified records', async () => {
  const feed = { features: [{ id: 'us-test', geometry: { coordinates: [127, 37, 10] }, properties: { type: 'earthquake', mag: 4.1, time: Date.now() } }] };
  const route = createWorldConnectRoutes({ fetcher: async () => Response.json(feed) });
  const request = () => new Request('https://example.test/api/world-connect/question', { method: 'POST',
    headers: { origin: 'https://example.test', 'content-type': 'application/json' },
    body: JSON.stringify({ id: 'us-test', question: '규모는?' }) });
  const good = environment({ response: '{"focus":"magnitude","magnitude":9.9}' });
  const answer = await (await route(request(), good.env)).json();
  assert.equal(answer.mode, 'grounded-answer'); assert.match(answer.text, /4.1/); assert.equal(answer.text.includes('9.9'), false);
  const limited = environment({ count: 50 });
  const fallback = await (await route(request(), limited.env)).json();
  assert.equal(fallback.mode, 'source-lookup'); assert.equal(fallback.ai.httpStatus, 429);
  assert.match(fallback.text, /4.1/); assert.equal(limited.calls.length, 0);
  const invalid = environment({ response: 'A destructive aftershock is certain.' });
  const rejected = await (await route(request(), invalid.env)).json();
  assert.equal(rejected.mode, 'evidence-only'); assert.equal(rejected.text.includes('destructive'), false);
});
