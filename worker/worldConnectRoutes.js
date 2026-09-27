import { localModelChat } from '../packages/god-runtime/ollama.js';

export const WORLD_EVENT_FEED = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson';
const json = (data, status = 200) => Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
const validId = id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(id);

export function eventFromFeature(feature) {
  const p = feature?.properties, c = feature?.geometry?.coordinates;
  if (!validId(feature?.id) || !p || !Array.isArray(c) || c.length < 3 ||
      !c.slice(0, 3).every(Number.isFinite) || Math.abs(c[0]) > 180 || Math.abs(c[1]) > 90 ||
      !Number.isFinite(p.mag) || !Number.isFinite(p.time) || !Number.isFinite(new Date(p.time).getTime())) return null;
  const sourceUrl = `https://earthquake.usgs.gov/earthquakes/eventpage/${encodeURIComponent(feature.id)}`;
  return { id: feature.id, title: `M${p.mag.toFixed(1)} ${String(p.place || '위치 미상').slice(0, 240)}`,
    magnitude: p.mag, place: String(p.place || '').slice(0, 240), time: p.time,
    updated: Number.isFinite(p.updated) ? p.updated : null,
    lon: c[0], lat: c[1], depthKm: c[2], state: 'source-reported', confidence: null,
    source: { title: 'USGS 사건 기록', url: sourceUrl },
    summary: `USGS는 ${new Date(p.time).toISOString()}에 규모 ${p.mag.toFixed(1)}, 깊이 ${c[2].toFixed(1)}km의 지진을 보고했습니다.` };
}

export function eventDistanceKm(a, b) {
  const rad = value => value * Math.PI / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function relateEvents(event, candidates) {
  return candidates.filter(other => other.id !== event.id).map(other => ({ event: other,
    distanceKm: eventDistanceKm(event, other), hoursApart: Math.abs(event.time - other.time) / 3600000 }))
    .filter(link => link.distanceKm <= 500 && link.hoursApart <= 24)
    .sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 5).map(link => ({ ...link,
      type: 'LOCATION', state: 'source-reported', confidence: null,
      reason: `${link.distanceKm.toFixed(1)}km 거리, 발생 시각 차이 ${link.hoursApart.toFixed(1)}시간. 위치·시간 인접 관계이며 인과 또는 여진 판단이 아닙니다.`,
      sources: [event.source, link.event.source] }));
}

export function createWorldConnectRoutes({ fetcher = fetch, chat = localModelChat, now = Date.now } = {}) {
  let cached = null, pending = null, cachedAt = 0;
  const windows = new Map();
  async function events() {
    if (cached && now() - cachedAt < 60000) return cached;
    if (pending) return pending;
    pending = (async () => {
      const response = await fetcher(WORLD_EVENT_FEED, { signal: AbortSignal.timeout(12000), cf: { cacheTtl: 60, cacheEverything: true } });
      if (!response.ok) throw new Error(`USGS HTTP ${response.status}`);
      const body = await response.text();
      if (body.length > 3000000) throw new Error('USGS 응답 크기 초과');
      const feed = JSON.parse(body);
      if (!Array.isArray(feed.features)) throw new Error('USGS 응답 형식 오류');
      cached = feed.features.slice(0, 4000).map(eventFromFeature).filter(event => event && event.magnitude >= 2.5);
      cachedAt = now(); return cached;
    })().finally(() => { pending = null; });
    return pending;
  }
  return async (request, env = {}) => {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/world-connect/')) return null;
    const path = url.pathname.split('/').at(-1);
    if (!['events', 'analyze', 'question'].includes(path)) return json({ error: '경로 없음' }, 404);
    if (request.method !== (path === 'question' ? 'POST' : 'GET')) return json({ error: '요청 방식 오류' }, 405);
    try {
      let input = null;
      if (path === 'question') {
        if (request.headers.get('origin') !== url.origin) return json({ error: '같은 사이트에서 요청하세요.' }, 403);
        if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'JSON 요청 필요' }, 415);
        const reader = request.body?.getReader(); if (!reader) return json({ error: '본문 없음' }, 400);
        const chunks = []; let bytes = 0;
        for (;;) { const part = await reader.read(); if (part.done) break; bytes += part.value.length;
          if (bytes > 4096) { await reader.cancel(); return json({ error: '본문 크기 초과' }, 413); } chunks.push(part.value); }
        const body = new Uint8Array(bytes); let offset = 0;
        for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
        input = JSON.parse(new TextDecoder().decode(body));
        if (typeof input?.question !== 'string' || !input.question.trim() || input.question.length > 1000) return json({ error: '질문 형식 오류' }, 400);
        const ip = request.headers.get('cf-connecting-ip') || 'local', time = now();
        for (const [key, value] of windows) if (value.until <= time) windows.delete(key);
        if (!windows.has(ip) && windows.size >= 512) return json({ error: '요청 대기 필요' }, 429);
        const limit = windows.get(ip) || { count: 0, until: time + 60000 }; windows.set(ip, limit);
        if (++limit.count > 6) return json({ error: '분당 질문 한도 6회' }, 429);
      }
      const id = input?.id || url.searchParams.get('id');
      if (path !== 'events' && !validId(id)) return json({ error: '사건 ID 형식 오류' }, 400);
      const rows = await events();
      if (path === 'events') return json({ events: [...rows].sort((a, b) => b.time - a.time).slice(0, 20), checkedAt: cachedAt, provider: 'USGS' });
      const event = rows.find(row => row.id === id);
      if (!event) return json({ error: '최근 24시간 피드에 사건이 없습니다. 출처 원문을 확인하세요.' }, 404);
      const relations = relateEvents(event, rows);
      if (path === 'analyze') return json({ event, relations, depth: 1, checkedAt: cachedAt,
        limitations: 'USGS 단일 출처. 인과·피해 예측·경제 영향은 미분석. 숫자 신뢰도는 부여하지 않습니다.' });
      const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && env.FLOW_LOCAL_RUNTIME === '1';
      if (!local || !env.OLLAMA_MODEL) return json({ error: 'AI 모델 미연결. 사건과 근거는 열람할 수 있습니다.', mode: 'unavailable' }, 503);
      const result = await chat({ text: JSON.stringify({ event, relations }), sources: [event.source, ...relations.map(link => link.event.source)],
        instruction: `질문: ${input.question}\n제공된 사건 기록만 사용하세요. LOCATION은 인과·여진 관계가 아닙니다. 확정 정보와 AI 추론을 구분하고 모르는 것은 모른다고 답하세요.` },
      { url: 'http://127.0.0.1:11434', model: env.OLLAMA_MODEL, signal: AbortSignal.any([request.signal, AbortSignal.timeout(85000)]) });
      return json({ ...result, state: 'ai-inference' });
    } catch (error) { return json({ error: String(error?.message || '연결 실패').slice(0, 240), provider: 'USGS / Ollama', retryAfterSeconds: 60 }, error instanceof SyntaxError ? 400 : 502); }
  };
}
export const worldConnectRoutes = createWorldConnectRoutes();
