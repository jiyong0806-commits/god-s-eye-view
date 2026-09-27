import { failure, retrySeconds } from './providerRuntime.js';

export async function withSharedCooldown(env, provider, load) {
  if (!env.PROVIDER_DB?.prepare) return load();
  let row;
  try {
    row = await env.PROVIDER_DB.prepare('SELECT retry_at FROM provider_cooldown WHERE provider = ?').bind(provider).first();
  } catch {
    return failure(provider, 503, '공급자 재시도 상태 DB 확인 실패', 60);
  }
  if (Number(row?.retry_at) > Date.now()) {
    return failure(provider, 429, '공급자 요청 제한 · 서버 공통 대기', Math.ceil((row.retry_at - Date.now()) / 1000));
  }
  const response = await load();
  if (response.status === 429) {
    const until = Date.now() + retrySeconds(response.headers.get('retry-after'), 120) * 1000;
    try {
      await env.PROVIDER_DB.prepare(`INSERT INTO provider_cooldown(provider, retry_at) VALUES (?, ?)
        ON CONFLICT(provider) DO UPDATE SET retry_at = MAX(retry_at, excluded.retry_at)`).bind(provider, until).run();
    } catch {
      // Keep the provider's original restriction even when persistence fails.
    }
  }
  return response;
}
