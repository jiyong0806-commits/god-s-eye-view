export const WORLD_AI_MODEL = '@cf/meta/llama-3.2-3b-instruct';
export const FOCUS_INSTRUCTION = '질문의 주제를 분류하세요. JSON 객체만 출력하세요: {"focus":"summary"}. focus는 summary,magnitude,location,time,depth,sources,relations,unknown 중 하나입니다. 확인된 정보나 요약 요청은 summary입니다. 여진·원인·피해·예측 질문은 unknown입니다. 사실 내용을 답하지 마세요.';

export function sourceQuestionFocus(question) {
  if (/여진|인과|원인|피해|예측|진도|aftershock|caus(?:e|al)|predict|damage|intensity/i.test(question)) return 'unknown';
  if (/출처|근거|source|evidence/i.test(question)) return 'sources';
  if (/규모|magnitude/i.test(question)) return 'magnitude';
  if (/깊이|depth/i.test(question)) return 'depth';
  if (/어디|위치|좌표|where|location/i.test(question)) return 'location';
  if (/언제|시간|시각|when|time/i.test(question)) return 'time';
  if (/관련|연결|relation/i.test(question)) return 'relations';
  if (/요약|정보|상황|summary|information/i.test(question)) return 'summary';
  return 'unknown';
}

function unavailable(code, message, status = 503, retryAfterSeconds = 60) {
  return Object.assign(new Error(message), { code, status, retryAfterSeconds });
}

export async function cloudWorldQuestion(env, question, { now = Date.now } = {}) {
  if (env.GEV_WORLD_AI_ENABLED !== '1' || env.GEV_WORLD_AI_FREE_CONFIRMED !== '1') {
    throw unavailable('ai-not-enabled', '서버 AI 무료 요금제 확인 또는 활성화 전');
  }
  if (!env.AI?.run || !env.PROVIDER_DB?.prepare) {
    throw unavailable('ai-binding-missing', '서버 AI 또는 사용량 DB 연결 누락');
  }
  const configured = Number(env.WORLD_AI_DAILY_BUDGET);
  const limit = Number.isInteger(configured) && configured > 0 ? Math.min(configured, 50) : 50;
  const time = now(), day = new Date(time).toISOString().slice(0, 10);
  let row;
  try {
    row = await env.PROVIDER_DB.prepare(`INSERT INTO provider_usage(service, day, scope, count)
      VALUES (?, ?, ?, 1) ON CONFLICT(service, day, scope) DO UPDATE SET count = count + 1
      WHERE count < ? RETURNING count`).bind('world-connect-ai', day, 'global', limit).first();
  } catch {
    throw unavailable('ai-budget-unavailable', 'AI 사용량 확인 실패. 모델 호출 중단');
  }
  if (!row) {
    const retry = Math.max(1, Math.ceil((Date.parse(`${day}T00:00:00Z`) + 86400000 - time) / 1000));
    throw unavailable('ai-daily-limit', `서버 AI 일일 한도 ${limit}회 도달 (UTC 자정 초기화)`, 429, retry);
  }
  // Failed calls consume the reservation too; no retries can bypass the daily cap.
  let timer;
  try {
    const result = await Promise.race([
      env.AI.run(WORLD_AI_MODEL, { messages: [
        { role: 'system', content: FOCUS_INSTRUCTION },
        { role: 'user', content: JSON.stringify({ question }) },
      ], max_tokens: 64, temperature: 0, response_format: { type: 'json_object' } }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(unavailable('ai-timeout', '서버 AI 응답 시간 초과')), 15000); }),
    ]);
    return { text: typeof result?.response === 'string' ? result.response.slice(0, 2000) : '', provider: 'Cloudflare Workers AI' };
  } catch (error) {
    if (error?.code === 'ai-timeout') throw error;
    throw unavailable('ai-provider-failed', '서버 AI 공급자 응답 실패');
  } finally { clearTimeout(timer); }
}
