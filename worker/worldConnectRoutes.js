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

export function guardWorldAnswer(result, event, relations = [], question = '') {
  // The model selects a focus only. All displayed facts come from verified server records.
  let focus;
  try { focus = JSON.parse(result.text).focus; } catch { focus = null; }
  if (/여진|인과|원인|피해|예측|aftershock|caus(?:e|al)|predict|damage/i.test(question)) focus = 'unknown';
  const answers = {
    summary: event.summary, magnitude: `USGS 보고 규모: ${event.magnitude.toFixed(1)}`,
    location: `USGS 원문 위치: ${event.place}\n좌표: ${event.lat}, ${event.lon}`,
    time: `발생 시각: ${new Date(event.time).toISOString()} (UTC)`,
    depth: `USGS 보고 깊이: ${event.depthKm.toFixed(1)}km`,
    sources: `출처: USGS\n${event.source.url}`,
    relations: relations.length ? relations.map(link => `${link.event.title} · ${link.reason}`).join('\n') : '500km · 24시간 범위의 관련 기록 없음',
    unknown: '제공된 위치·시간 기록만으로 여진, 인과 관계 또는 피해를 판단할 수 없습니다. 추가 독립 근거가 필요합니다.',
  };
  const valid = typeof focus === 'string' && Object.hasOwn(answers, focus);
  return { ...result, text: valid ? answers[focus] : `${event.summary}\nAI 질문 해석을 검증할 수 없어 원본 요약만 표시합니다. 추가 판단은 할 수 없습니다.`,
    provider: valid ? `${result.provider} 질문 해석 / USGS 근거` : 'USGS 원본 요약 (모델 응답 제외)',
    state: 'source-reported', mode: valid ? 'grounded-answer' : 'evidence-only' };
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
      const result = await chat({ text: JSON.stringify({ question: input.question }), sources: [event.source, ...relations.map(link => link.event.source)],
        instruction: '질문의 주제를 분류하세요. JSON 객체만 출력하세요: {"focus":"summary"}. focus는 summary,magnitude,location,time,depth,sources,relations,unknown 중 하나입니다. 확인된 정보나 요약 요청은 summary입니다. 여진·원인·피해·예측 질문은 unknown입니다. 사실 내용을 답하지 마세요.' },
      { url: 'http://127.0.0.1:11434', model: env.OLLAMA_MODEL, maxTokens: 64, contextSize: 1024, jsonFormat: true,
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(85000)]) });
      return json(guardWorldAnswer(result, event, relations, input.question));
    } catch (error) { return json({ error: ['TimeoutError', 'AbortError'].includes(error?.name) ? '응답 시간 초과. 잠시 후 다시 시도하세요.' : String(error?.message || '연결 실패').slice(0, 240), provider: 'USGS / Ollama', retryAfterSeconds: 60 }, error instanceof SyntaxError ? 400 : 502); }
  };
}
export const worldConnectRoutes = createWorldConnectRoutes();
