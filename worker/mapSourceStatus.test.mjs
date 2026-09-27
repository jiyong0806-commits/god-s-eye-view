import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapSourceStatus } from './mapSourceStatus.js';

test('daily source status is not represented as a new imagery acquisition', async () => {
  const result = await mapSourceStatus({}, async () => Response.json([{ checked_at: '2026-09-27T02:17:01Z', health: 'available' }]));
  const body = await result.json(); assert.equal(body.imageryAcquisitionDate, null);
  assert.match(body.scope, /촬영일 갱신.*아닙니다/); assert.equal(body.scheduleKst, '01:10');
});
test('missing and failing status DB do not fabricate successful refresh', async () => {
  assert.equal((await mapSourceStatus({}, async () => Response.json([]))).status, 503);
  assert.equal((await mapSourceStatus({}, async () => new Response('', { status: 401 }))).status, 502);
});
