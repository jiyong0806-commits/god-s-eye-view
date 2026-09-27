import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { AisCollector, normalizeAisPosition } from './aisCollector.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const packet = (extra = {}) => ({ MessageType: 'PositionReport', MetaData: { MMSI: 123456789, ShipName: 'TEST', Latitude: 37, Longitude: 127 },
  Message: { PositionReport: { Sog: 12, Cog: 360, TrueHeading: 511 } }, ...extra });
function context() {
  const values = new Map(), waits = [];
  return { values, waits, ctx: { blockConcurrencyWhile: fn => fn(), waitUntil: p => waits.push(p),
    storage: { get: async k => values.get(k), put: async (k, v) => values.set(k, v), setAlarm: async () => {} } } };
}
class Socket extends EventTarget {
  accept() {} close() { this.closed = true; } send(value) { this.sent = JSON.parse(value); }
  message(value) { this.dispatchEvent(new MessageEvent('message', { data: new TextEncoder().encode(JSON.stringify(value)).buffer })); }
}

test('only actual valid position reports create vessel rows, AIS sentinels are not coordinates or headings', () => {
  assert.equal(normalizeAisPosition({ MessageType: 'SubscriptionConfirmation' }), null);
  assert.equal(normalizeAisPosition(packet({ MetaData: { MMSI: 123456789, Latitude: 91, Longitude: 181 } })), null);
  assert.equal(normalizeAisPosition(packet({ MetaData: { MMSI: 123456789, Latitude: null, Longitude: null } })), null);
  const row = normalizeAisPosition(packet());
  assert.equal(row.mmsi, '123456789'); assert.equal(row.heading, null); assert.equal(row.course, null);
  assert.equal(row.timestampBasis, 'server-receipt');
});

test('stale provider timestamps cannot masquerade as a current report', () => {
  const p = packet(); p.MetaData.time_utc = '2020-01-01T00:00:00Z';
  assert.equal(normalizeAisPosition(p), null);
  p.MetaData.time_utc = new Date().toISOString();
  assert.equal(normalizeAisPosition(p).timestampBasis, 'provider-report');
});

test('single provider connection is shared and real binary position frames reach snapshot', async () => {
  const { ctx } = context(); const socket = new Socket(); let calls = 0;
  globalThis.fetch = async () => { calls++; return { status: 101, webSocket: socket }; };
  const collector = new AisCollector(ctx, { AISSTREAM_API_KEY: 'test-private-value' });
  await collector.ready; await Promise.all([collector.connect(), collector.connect()]);
  assert.equal(calls, 1); assert.equal(socket.sent.APIKey, 'test-private-value');
  socket.message({ MessageType: 'SubscriptionConfirmation' }); assert.equal(collector.lastMessageAt, null);
  socket.message(packet());
  const response = await collector.fetch(new Request('https://internal/api/ais-live'));
  const data = await response.json(); assert.equal(data.status, 'live'); assert.equal(data.rows.length, 1);
  assert.equal(JSON.stringify(data).includes('test-private-value'), false);
  collector.lastRequestAt = Date.now() - 180001;
  await collector.alarm(); assert.equal(socket.closed, true); assert.equal(collector.status, 'idle');
});

test('provider rejection backs off, never credits a handshake as live and does not expose raw secrets', async () => {
  const { ctx } = context(); const socket = new Socket(); let calls = 0;
  globalThis.fetch = async () => { calls++; return { status: 101, webSocket: socket }; };
  const collector = new AisCollector(ctx, { AISSTREAM_API_KEY: 'private-key' });
  await collector.ready; await collector.connect();
  socket.message({ error: 'invalid API key private-key' });
  assert.equal(collector.status, 'auth-failed'); await collector.connect(); assert.equal(calls, 1);
  const data = await (await collector.fetch(new Request('https://internal/api/ais-live'))).json();
  assert.equal(data.rows.length, 0); assert.equal(data.refreshing, true); assert.equal(data.error.includes('private-key'), false);
  assert.ok(data.nextAttemptAt > Date.now() + 3500000);
});

test('snapshot limits, method guards and absent track history are explicit', async () => {
  const { ctx } = context(); const collector = new AisCollector(ctx, {});
  assert.equal((await collector.fetch(new Request('https://internal/api/ais-live', { method: 'POST' }))).status, 405);
  assert.equal((await collector.fetch(new Request('https://internal/api/ais-live/track?mmsi=invalid'))).status, 400);
  const track = await (await collector.fetch(new Request('https://internal/api/ais-live/track?mmsi=123456789'))).json();
  assert.deepEqual(track.samples, []); assert.match(track.error, /not enabled/);
  await collector.connect(); assert.equal(collector.status, 'missing-key');
});
