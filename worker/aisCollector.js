const STREAM_URL = 'https://stream.aisstream.io/v0/stream';
const MAX_VESSELS = 5000;
const MAX_FRAME_BYTES = 32768;
const POSITION_TTL_MS = 30 * 60 * 1000;
const SILENCE_MS = 120000;
const TYPES = ['PositionReport', 'StandardClassBPositionReport', 'ExtendedClassBPositionReport'];
const finite = value => value === null || value === undefined || value === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null;

export function normalizeAisPosition(envelope, receivedAt = Date.now()) {
  if (!TYPES.includes(envelope?.MessageType)) return null;
  const message = envelope.Message?.[envelope.MessageType], meta = envelope.MetaData || envelope.Metadata;
  if (!message || !meta || message.Valid === false) return null;
  const mmsi = String(meta.MMSI ?? message.UserID ?? '');
  const lat = finite(message.Latitude ?? meta.latitude ?? meta.Latitude);
  const lon = finite(message.Longitude ?? meta.longitude ?? meta.Longitude);
  if (!/^\d{9}$/.test(mmsi) || lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const rawTime = String(meta.time_utc || meta.TimeUtc || '');
  const reportAt = Date.parse(rawTime.replace(/ \+0000 UTC$/, 'Z').replace(/ UTC$/, 'Z').replace(/ \+0000$/, 'Z'));
  const hasReportTime = Number.isFinite(reportAt) && reportAt <= receivedAt + 60000 && reportAt >= receivedAt - POSITION_TTL_MS;
  if (Number.isFinite(reportAt) && !hasReportTime) return null;
  const positionAt = hasReportTime ? reportAt : receivedAt;
  const speed = finite(message.Sog), course = finite(message.Cog), heading = finite(message.TrueHeading);
  return { mmsi, lat, lon, name: String(meta.ShipName || `MMSI ${mmsi}`).trim().slice(0, 120),
    speed: speed !== null && speed >= 0 && speed < 102.3 ? speed : null,
    course: course !== null && course >= 0 && course < 360 ? course : null,
    heading: heading !== null && heading >= 0 && heading < 360 ? heading : null,
    type: '', destination: '', receivedAt, timestampBasis: hasReportTime ? 'provider-report' : 'server-receipt',
    last_position_UTC: new Date(positionAt).toISOString(), last_position_epoch: Math.floor(positionAt / 1000) };
}

export class AisCollector {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env; this.rows = new Map(); this.socket = null; this.pending = null;
    this.lastMessageAt = null; this.status = 'idle'; this.error = null; this.retryAt = 0;
    this.attempt = 0; this.generation = 0; this.persistAt = 0; this.persistPending = null;
    this.lastRequestAt = 0; this.alarmAt = 0;
    this.ready = ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get('snapshot');
      if (saved) {
        this.lastMessageAt = saved.lastMessageAt; this.retryAt = saved.retryAt || 0;
        this.status = saved.status === 'auth-failed' ? 'auth-failed' : 'idle';
        for (const row of saved.rows || []) if (row.receivedAt > Date.now() - POSITION_TTL_MS) this.rows.set(row.mmsi, row);
      }
    });
  }

  async connect() {
    if (this.pending || this.socket || this.retryAt > Date.now()) return;
    if (!this.env.AISSTREAM_API_KEY) { this.status = 'missing-key'; this.error = 'AISSTREAM_API_KEY not configured'; return; }
    const generation = ++this.generation;
    this.status = 'connecting'; this.error = null;
    this.pending = (async () => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        let response;
        try { response = await fetch(STREAM_URL, { headers: { Upgrade: 'websocket' }, signal: controller.signal }); }
        finally { clearTimeout(timer); }
        if (response.status !== 101 || !response.webSocket) {
          this.fail(response.status === 401 || response.status === 403 ? 'auth-failed' : 'down', response.status === 429 ? 900000 : 0); return;
        }
        const socket = response.webSocket;
        socket.binaryType = 'arraybuffer';
        if (generation !== this.generation) { socket.accept(); socket.close(1000, 'superseded'); return; }
        this.socket = socket; socket.accept();
        socket.addEventListener('message', event => {
          if (this.socket !== socket) return;
          const bytes = event.data;
          if ((typeof bytes === 'string' ? bytes.length : bytes?.byteLength) > MAX_FRAME_BYTES) return;
          let envelope;
          try { envelope = JSON.parse(typeof bytes === 'string' ? bytes : new TextDecoder().decode(bytes)); } catch { return; }
          if (envelope.error || envelope.Error) {
            const detail = String(envelope.error || envelope.Error);
            this.fail(/key|auth|unauthor|forbidden/i.test(detail) ? 'auth-failed' : 'down', /limit|connections|quota|429/i.test(detail) ? 900000 : 0); return;
          }
          const row = normalizeAisPosition(envelope);
          if (!row) return;
          this.lastMessageAt = Date.now(); this.status = 'live'; this.error = null; this.attempt = 0;
          this.rows.delete(row.mmsi); this.rows.set(row.mmsi, row);
          if (this.rows.size > MAX_VESSELS) this.rows.delete(this.rows.keys().next().value);
          if (Date.now() >= this.persistAt) this.persist();
        });
        const closed = () => { if (this.socket === socket) this.fail('down'); };
        socket.addEventListener('close', closed); socket.addEventListener('error', closed);
        // Credentials never leave the server except in the provider subscription.
        socket.send(JSON.stringify({ APIKey: this.env.AISSTREAM_API_KEY,
          BoundingBoxes: [[[-90, -180], [90, 180]]], FilterMessageTypes: TYPES }));
      } catch { this.fail('down'); }
      finally { this.pending = null; }
    })();
    await this.pending;
  }

  fail(status, minimumDelay = 0) {
    const socket = this.socket; this.socket = null; ++this.generation;
    try { socket?.close(1000, 'reconnect later'); } catch { /* already closed */ }
    this.status = status; this.error = status === 'auth-failed' ? 'AISStream rejected server credentials' : 'AISStream connection interrupted';
    const delay = status === 'auth-failed' ? 3600000 : [30000, 120000, 300000, 900000][Math.min(this.attempt++, 3)];
    this.retryAt = Date.now() + Math.max(delay, minimumDelay); this.persist();
  }

  persist() {
    this.persistAt = Date.now() + 60000;
    if (this.persistPending) return;
    this.prune();
    this.persistPending = this.ctx.storage.put('snapshot', {
      rows: [...this.rows.values()].slice(-200), lastMessageAt: this.lastMessageAt, retryAt: this.retryAt, status: this.status,
    }).catch(() => { this.persistAt = Date.now() + 60000; }).finally(() => { this.persistPending = null; });
    this.ctx.waitUntil(this.persistPending);
  }

  prune() {
    const cutoff = Date.now() - POSITION_TTL_MS;
    for (const [key, row] of this.rows) if (row.receivedAt < cutoff || row.last_position_epoch * 1000 < cutoff) this.rows.delete(key);
  }

  async alarm() {
    this.alarmAt = 0;
    if (Date.now() - this.lastRequestAt > 180000) {
      const socket = this.socket; this.socket = null; ++this.generation;
      try { socket?.close(1000, 'no active viewers'); } catch { /* already closed */ }
      this.status = 'idle'; this.persist(); return;
    }
    if (this.socket && this.lastMessageAt && Date.now() - this.lastMessageAt > SILENCE_MS * 2.5) this.fail('down');
    await this.connect();
    this.alarmAt = Date.now() + 60000;
    await this.ctx.storage.setAlarm(this.alarmAt);
  }

  async fetch(request) {
    await this.ready;
    if (request.method !== 'GET') return Response.json({ error: 'method-not-allowed' }, { status: 405 });
    const url = new URL(request.url);
    if (!['/api/ais-live', '/api/ais-live/track'].includes(url.pathname)) return Response.json({ error: 'not-found' }, { status: 404 });
    if (url.pathname.endsWith('/track')) {
      const mmsi = url.searchParams.get('mmsi');
      if (!/^\d{9}$/.test(mmsi || '')) return Response.json({ error: 'invalid MMSI', samples: [] }, { status: 400 });
      return Response.json({ mmsi, samples: [], source: 'AISStream', error: 'Historical track collection is not enabled' });
    }
    this.lastRequestAt = Date.now();
    if (!this.alarmAt) { this.alarmAt = Date.now() + 60000; await this.ctx.storage.setAlarm(this.alarmAt); }
    if (this.socket && this.lastMessageAt && Date.now() - this.lastMessageAt > SILENCE_MS * 2.5) this.fail('down');
    if (!this.pending && !this.socket && this.retryAt <= Date.now()) this.ctx.waitUntil(this.connect());
    this.prune();
    const max = Math.max(1, Math.min(MAX_VESSELS, Number(url.searchParams.get('maxRows')) || 1500));
    const rows = [...this.rows.values()].slice(-max);
    const silent = this.lastMessageAt ? Math.max(0, Date.now() - this.lastMessageAt) : null;
    const fresh = this.status === 'live' && silent !== null && silent <= SILENCE_MS;
    return Response.json({ rows, count: rows.length, source: 'AISStream', status: this.status === 'live' && !fresh ? 'stale' : this.status,
      refreshing: !fresh, error: this.error, lastMessageAt: this.lastMessageAt,
      newestPositionAt: rows.length ? Math.max(...rows.map(row => row.last_position_epoch * 1000)) : null,
      silentForMs: silent, nextAttemptAt: this.retryAt || null, reconnectAttempt: this.attempt,
      staleAfterMs: SILENCE_MS, coverage: 'Received AIS broadcasts only; worldwide subscription, capped at 5000 vessels',
      compression: 'uncompressed Workers outbound WebSocket; provider bandwidth limits apply' },
    { status: this.status === 'missing-key' ? 503 : 200, headers: { 'cache-control': 'no-store' } });
  }
}

export default {
  fetch(request, env) {
    const id = env.AIS_COLLECTOR.idFromName('provider-single-stream-v1');
    return env.AIS_COLLECTOR.get(id).fetch(request);
  },
};
