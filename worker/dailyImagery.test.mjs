import { test } from 'node:test';
import assert from 'node:assert/strict';
import { latestImageryDate, dailyImagery } from './dailyImagery.js';
const domain = value => `<Domains><DimensionDomain><Domain>${value}</Domain></DimensionDomain></Domains>`;
test('NASA date comes from provider intervals, not an invented current date', () => {
  assert.equal(latestImageryDate(domain('2026-01-01/2026-10-02/P1D,2026-10-03'), new Date('2026-10-03T12:00Z')), '2026-10-03');
  assert.equal(latestImageryDate(domain('2026-10-01/2026-10-02/P1D,2026-10-05'), new Date('2026-10-03T12:00Z')), '2026-10-02');
  assert.throws(() => latestImageryDate('<!DOCTYPE evil>' + domain('2026-10-03')));
});
test('unavailable NASA metadata does not return fake imagery dates', async () => {
  const response = await dailyImagery(async () => new Response('', { status: 503 }));
  assert.equal(response.status, 502); assert.equal((await response.json()).date, undefined);
});
