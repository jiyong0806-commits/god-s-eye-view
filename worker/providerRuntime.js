const cache = new Map();
const cooldowns = new Map();
const MAX_CACHE_ENTRIES = 96;
const MAX_CACHE_BYTES = 16 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

export function clearProviderCache() { cache.clear(); cooldowns.clear(); }

async function readBounded(response) {
  if (!response.body) return null;
  const reader = response.body.getReader(); const chunks = []; let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > MAX_RESPONSE_BYTES) { await reader.cancel(); throw new Error('response-too-large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}

export function reply(body, status = 200, headers = {}) {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store', ...headers } });
}

export function retrySeconds(value, fallback = 60, now = Date.now()) {
  if (value === null || value === undefined || value === '') return fallback;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.max(1, Math.ceil(seconds));
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(1, Math.ceil((date - now) / 1000)) : fallback;
}

export function failure(provider, status, error, retry = 60) {
  return reply({ provider, status: status === 429 || status === 451 ? 'restricted' : 'unavailable',
    httpStatus: status, error, retryInSec: retry, retryAt: Date.now() + retry * 1000 }, status,
  { 'x-data-source': provider, 'retry-after': String(retry) });
}

export async function upstream(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return new Response(await readBounded(response), { status: response.status, headers: response.headers });
  }
  finally { clearTimeout(timer); }
}

// Shared promises and provider-wide backoff also cover requests for different map cells.
export async function cachedProvider(key, provider, ttlMs, load) {
  const now = Date.now();
  let entry = cache.get(key);
  if (entry?.response && entry.expires > now) {
    if (entry.response.status !== 429) return entry.response.clone();
    const response = entry.response.clone();
    response.headers.set('retry-after', String(Math.max(1, Math.ceil((entry.expires - now) / 1000))));
    return response;
  }
  const retryAt = cooldowns.get(provider) || 0;
  if (retryAt > now) return failure(provider, 429, '공급자 요청 제한', Math.ceil((retryAt - now) / 1000));
  if (entry?.pending) return (await entry.pending).clone();
  if (cache.size >= MAX_CACHE_ENTRIES && ![...cache.values()].some(value => !value.pending)) return failure(provider, 503, '서버 요청 처리 중', 15);
  entry = { response: null, expires: 0, pending: null };
  cache.set(key, entry);
  while (cache.size > MAX_CACHE_ENTRIES) {
    const evict = [...cache].find(([candidate, value]) => candidate !== key && !value.pending);
    if (!evict) break;
    cache.delete(evict[0]);
  }
  entry.pending = (async () => {
    try {
      const response = await load();
      if (response.status === 429) {
        cooldowns.set(provider, Date.now() + retrySeconds(response.headers.get('retry-after')) * 1000);
      }
      const body = await readBounded(response);
      const headers = new Headers(response.headers);
      headers.set('x-data-source', provider);
      headers.set('x-observed-at', new Date().toISOString());
      entry.response = new Response(body, { status: response.status, headers });
      entry.bytes = body?.byteLength || 0;
      let bytes = [...cache.values()].reduce((sum, value) => sum + (value.bytes || 0), 0);
      for (const [candidate, value] of cache) {
        if (bytes <= MAX_CACHE_BYTES) break;
        if (candidate !== key && !value.pending) { bytes -= value.bytes || 0; cache.delete(candidate); }
      }
      for (const [name, until] of cooldowns) if (until <= Date.now()) cooldowns.delete(name);
      entry.expires = Date.now() + (response.ok ? ttlMs : response.status === 429
        ? retrySeconds(response.headers.get('retry-after')) * 1000 : 15000);
      return entry.response;
    } catch (error) {
      entry.response = failure(provider, 502, error?.name === 'AbortError' ? '공급자 응답 시간 초과' : '공급자 연결 실패');
      entry.expires = Date.now() + 15000;
      return entry.response;
    } finally { entry.pending = null; }
  })();
  return (await entry.pending).clone();
}

export async function jsonFeed(url, provider, ttl = 300, validate = () => true) {
  return cachedProvider(url, provider, ttl * 1000, async () => {
    const response = await upstream(url, { headers: { accept: 'application/json' }, cf: { cacheTtl: ttl, cacheEverything: true } });
    if (!response.ok) return failure(provider, response.status, `${provider} HTTP ${response.status}`,
      retrySeconds(response.headers.get('retry-after')));
    const data = await response.json();
    if (!validate(data)) return failure(provider, 502, '공급자 데이터 형식 불일치');
    return reply(data, 200, { 'cache-control': `public, max-age=${Math.min(ttl, 300)}, s-maxage=${ttl}` });
  });
}

export function dailyBudget(env, service) {
  const maximum = service === 'tomtom' ? 500 : 50;
  const value = Number(env[service === 'tomtom' ? 'TOMTOM_DAILY_BUDGET' : 'ELEVENLABS_DAILY_BUDGET']);
  return Number.isInteger(value) && value > 0 ? Math.min(value, maximum) : maximum;
}

export async function reserveBudget(env, service, scope = 'global') {
  if (!env.PROVIDER_DB?.prepare) return false;
  const day = new Date().toISOString().slice(0, 10);
  const limit = dailyBudget(env, service);
  const row = await env.PROVIDER_DB.prepare(`INSERT INTO provider_usage(service, day, scope, count)
    VALUES (?, ?, ?, 1) ON CONFLICT(service, day, scope) DO UPDATE SET count = count + 1
    WHERE count < ? RETURNING count`).bind(service, day, scope, limit).first();
  return Boolean(row);
}
