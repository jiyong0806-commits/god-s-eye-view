import { localModelChat } from '../packages/god-runtime/ollama.js';
import { reply } from './providerRuntime.js';

export function createVoiceRoutes({ chat = localModelChat } = {}) {
  let busy = false;
  return async (request, env, url) => {
    if (url.pathname !== '/api/voice/interpret') return null;
    if (request.method !== 'POST') return reply({ error: 'method-not-allowed' }, 405);
    if (request.headers.get('origin') !== url.origin) return reply({ error: 'origin-not-allowed' }, 403);
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || env.FLOW_LOCAL_RUNTIME !== '1')
      return reply({ error: 'Ollama는 이 PC의 로컬 실행에서만 연결됩니다. 공개 사이트는 기본 한국어 명령을 사용합니다.' }, 503);
    if (!env.OLLAMA_MODEL) return reply({ error: 'Ollama 모델 미설정' }, 503);
    if (!request.headers.get('content-type')?.startsWith('application/json')) return reply({ error: 'json-required' }, 415);
    if (busy) return reply({ error: '모델 응답 대기 중' }, 429, { 'retry-after': '10' });
    const reader = request.body?.getReader(); if (!reader) return reply({ error: 'body-required' }, 400);
    let text = ''; let size = 0; const decoder = new TextDecoder();
    for (;;) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.length;
      if (size > 24000) { await reader.cancel(); return reply({ error: 'body-too-large' }, 413); }
      text += decoder.decode(chunk.value, { stream: true }); }
    let acquired = false;
    try {
      const input = JSON.parse(text + decoder.decode());
      if (!input || typeof input.system !== 'string' || input.system.length > 14000 || !Array.isArray(input.messages)
        || input.messages.length === 0 || input.messages.length > 10 || input.messages.some(m => !m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string'))
        return reply({ error: 'invalid-command-context' }, 400);
      if (busy) return reply({ error: '모델 응답 대기 중' }, 429, { 'retry-after': '10' });
      busy = true;
      acquired = true;
      const result = await chat({ text: JSON.stringify(input.messages), instruction: input.system },
        { url: 'http://127.0.0.1:11434', model: env.OLLAMA_MODEL, maxTokens: 500, jsonFormat: true,
          signal: AbortSignal.any([request.signal, AbortSignal.timeout(85000)]) });
      return reply(result);
    } catch (error) { return reply({ error: error instanceof SyntaxError ? 'invalid-json' : 'Ollama 명령 해석 실패' }, error instanceof SyntaxError ? 400 : 502); }
    finally { if (acquired) busy = false; }
  };
}
export const voiceRoutes = createVoiceRoutes();
