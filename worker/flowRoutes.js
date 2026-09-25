import { searchWikipedia } from '../tools/search/wikipedia.js';
import { localModelChat, localModelStatus } from '../packages/god-runtime/ollama.js';

const json = (data, status = 200) => Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
export function createFlowRoutes({ search = searchWikipedia, chat = localModelChat, probe = localModelStatus, now = Date.now } = {}) {
const windows = new Map();
return async function handleFlowRoutes(request, env = {}) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/flow/')) return null;
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && env.FLOW_LOCAL_RUNTIME === '1';
  const localReady = local && Boolean(env.OLLAMA_MODEL);
  if (url.pathname === '/api/flow/status') {
    if (request.method !== 'GET') return json({ error: 'GET 요청만 허용됩니다.' }, 405);
    const model = localReady ? await probe({ model: env.OLLAMA_MODEL, signal: request.signal }) : { available: false, reason: '로컬 모델 연결 대기' };
    return json({ search: { provider: 'Wikipedia', scope: '백과사전 검색', configured: true },
    ai: { provider: 'Ollama', configured: model.available, model: model.available ? env.OLLAMA_MODEL : null,
      reason: model.reason },
    storage: { provider: 'browser', scope: '이 브라우저' }, browser: { configured: false }, mcp: { transport: 'stdio', public: false } });
  }
  if (!['/api/flow/search', '/api/flow/ai'].includes(url.pathname)) return json({ error: '도구 경로가 없습니다.' }, 404);
  if (request.method !== 'POST') return json({ error: 'POST 요청만 허용됩니다.' }, 405);
  if (request.headers.get('origin') !== url.origin) return json({ error: '같은 사이트에서 요청하세요.' }, 403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'JSON 요청이 필요합니다.' }, 415);
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  const time = now();
  for (const [key, entry] of windows) if (entry.until <= time) windows.delete(key);
  if (!windows.has(ip) && windows.size >= 512) return json({ error: '요청이 많습니다. 잠시 후 다시 시도하세요.' }, 429);
  const window = windows.get(ip) || { count: 0, until: time + 60000 };
  windows.set(ip, window);
  if (++window.count > 12) {
    const response = json({ error: '1분 요청 한도입니다. 잠시 후 다시 시도하세요.', retryAfterSeconds: Math.ceil((window.until - time) / 1000) }, 429);
    response.headers.set('retry-after', String(Math.ceil((window.until - time) / 1000))); return response;
  }
  let raw = '';
  try {
    const reader = request.body?.getReader();
    if (!reader) return json({ error: '요청 본문이 없습니다.' }, 400);
    const decoder = new TextDecoder(); let bytes = 0;
    while (true) {
      const part = await reader.read(); if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 40000) { await reader.cancel(); return json({ error: '요청이 너무 큽니다.' }, 413); }
      raw += decoder.decode(part.value, { stream: true });
    }
    raw += decoder.decode();
    const input = JSON.parse(raw);
    if (!input || typeof input !== 'object' || Array.isArray(input)) return json({ error: 'JSON 객체가 필요합니다.' }, 400);
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(url.pathname.endsWith('/ai') ? 85000 : 12000)]);
    if (url.pathname.endsWith('/search')) {
      if (typeof input.query !== 'string' || !input.query.trim() || input.query.length > 12000) return json({ error: '검색어 형식이 올바르지 않습니다.' }, 400);
      return json(await search(input.query, { signal }));
    }
    if (!localReady) return json({ error: local ? '로컬 AI 연결 대기: Ollama 설치와 모델 설정이 필요합니다.' : '공개 사이트에는 아직 보안 모델 연결이 없습니다.' }, 503);
    if (typeof input.text !== 'string' || input.text.length > 24000) return json({ error: 'AI 입력 형식이 올바르지 않습니다.' }, 400);
    const sources = Array.isArray(input.sources) ? input.sources.slice(0, 20).filter(s => typeof s?.url === 'string' && /^https:\/\//.test(s.url))
      .map(s => ({ url: s.url.slice(0, 1000), title: String(s.title || '').slice(0, 200) })) : [];
    return json(await chat({ text: input.text, sources, instruction: input.instruction },
      { signal, url: 'http://127.0.0.1:11434', model: env.OLLAMA_MODEL }));
  } catch (error) {
    return json({ error: error instanceof SyntaxError ? 'JSON 형식 오류' :
      ['AbortError', 'TimeoutError'].includes(error?.name) ? '도구 응답 시간 초과' : String(error?.message || '도구 연결 실패').slice(0, 250) },
    error instanceof SyntaxError ? 400 : 502);
  }
};
}
export const flowRoutes = createFlowRoutes();
