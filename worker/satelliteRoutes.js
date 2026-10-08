import { validateSatelliteSearch, sceneFromStac, previewPermission, validSceneId, STAC_COLLECTION } from '../src/satelliteExplorer/model.js';

const ROOT = 'https://earth-search.aws.element84.com/v1';
const json = (body, status = 200, headers = {}) => Response.json(body, { status, headers: { 'cache-control': 'no-store', ...headers } });
async function readBounded(response, maxBytes) {
  if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('공급자 응답 크기 초과');
  const reader = response.body?.getReader(); if (!reader) throw new Error('공급자 응답 없음');
  let size = 0; const chunks = [];
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new Error('공급자 응답 크기 초과'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const part of chunks) { bytes.set(part, offset); offset += part.byteLength; }
  return bytes;
}
export function createSatelliteRoutes({ fetcher = fetch, now = Date.now } = {}) {
  const windows = new Map(); let retryAt = 0;
  return async function satelliteRoutes(request) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/satellite/')) return null;
    if (!['search', 'scene', 'preview'].includes(url.pathname.split('/').at(-1))) return json({ error: '위성 경로 없음' }, 404);
    if (request.method !== 'GET') return json({ error: 'GET 요청 필요' }, 405);
    let target;
    const preview = url.pathname.endsWith('/preview');
    try {
      if (url.pathname.endsWith('/search')) {
        const bbox = url.searchParams.get('bbox');
        if (!bbox || bbox.split(',').some(value => !value.trim())) throw new Error('검색 좌표 필요');
        const cloud = url.searchParams.get('cloud');
        if (cloud === null || !cloud.trim()) throw new Error('구름 비율 필요');
        const query = validateSatelliteSearch({ bounds: bbox.split(',').map(Number),
          dateRange: [url.searchParams.get('start'), url.searchParams.get('end')], maxCloudCover: Number(cloud) }, now());
        target = new URL(`${ROOT}/search`);
        target.search = new URLSearchParams({ collections: STAC_COLLECTION, bbox: query.bounds.join(','),
          datetime: `${query.dateRange[0]}T00:00:00Z/${query.dateRange[1]}T23:59:59Z`,
          query: JSON.stringify({ 'eo:cloud_cover': { lte: query.maxCloudCover } }), limit: '12', sortby: '-properties.datetime' }).toString();
      } else {
        const id = url.searchParams.get('id'); if (!validSceneId(id)) throw new Error('영상 ID 형식 오류');
        target = new URL(`${ROOT}/collections/${STAC_COLLECTION}/items/${id}`);
      }
    } catch (error) { return json({ error: error.message, provider: 'Earth Search' }, 400); }
    const time = now(), ip = request.headers.get('cf-connecting-ip') || 'local';
    for (const [key, value] of windows) if (value.until <= time) windows.delete(key);
    if (retryAt > time) return json({ error: 'Earth Search 공급자 요청 제한', provider: 'Earth Search', retryAfterSeconds: Math.ceil((retryAt - time) / 1000) }, 429);
    if (!windows.has(ip) && windows.size >= 512) return json({ error: '요청 대기 필요' }, 503);
    const window = windows.get(ip) || { count: 0, until: time + 60000 }; windows.set(ip, window);
    if (++window.count > 12) return json({ error: '위성 조회 분당 12회 제한', retryAfterSeconds: Math.ceil((window.until - time) / 1000) }, 429);
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(12000)]);
    const load = async (href, max, accept) => {
      const response = await fetcher(href, { signal, redirect: 'manual', headers: { accept }, cf: { cacheTtl: 300, cacheEverything: true } });
      if (!response.ok) {
        const seconds = Math.min(3600, Math.max(30, Number(response.headers.get('retry-after')) || 60));
        if (response.status === 429) retryAt = now() + seconds * 1000;
        const error = new Error(`Earth Search HTTP ${response.status}`); error.status = response.status >= 300 && response.status < 400 ? 502 : response.status; error.retryAfterSeconds = seconds; throw error;
      }
      return { response, bytes: await readBounded(response, max) };
    };
    try {
      const raw = await load(target.href, 1500000, 'application/geo+json,application/json');
      const data = JSON.parse(new TextDecoder().decode(raw.bytes));
      if (url.pathname.endsWith('/search')) {
        if (!Array.isArray(data.features)) throw new Error('STAC 목록 형식 오류');
        const scenes = data.features.slice(0, 12).map(item => sceneFromStac(item, now())).filter(Boolean);
        return json({ scenes, retrievedAt: now(), provider: 'Earth Search', sourceId: 'sentinel-2-earth-search',
          hasMore: data.links?.some(link => link.rel === 'next') || false }, 200, { 'cache-control': 'public, max-age=300' });
      }
      const scene = sceneFromStac(data, now());
      if (!scene || scene.id !== url.searchParams.get('id')) throw new Error('STAC 영상 형식 오류');
      if (!preview) return json({ scene }, 200, { 'cache-control': 'public, max-age=300' });
      const permission = previewPermission(scene);
      if (!permission.allowed) return json({ error: permission.reason }, 422);
      const asset = scene.assets.find(item => item.id === 'thumbnail');
      const image = await load(asset.href, 4000000, 'image/jpeg');
      if (!image.response.headers.get('content-type')?.startsWith('image/jpeg') || image.bytes[0] !== 255 || image.bytes[1] !== 216 || image.bytes[2] !== 255) throw new Error('미리보기 이미지 형식 오류');
      return new Response(image.bytes, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=86400', 'x-content-type-options': 'nosniff' } });
    } catch (error) {
      return json({ error: ['AbortError', 'TimeoutError'].includes(error.name) ? '위성 조회 취소 또는 응답 시간 초과' : String(error.message).slice(0, 180),
        provider: 'Earth Search', retryAfterSeconds: error.retryAfterSeconds || 60 }, error.status || 502,
      { 'retry-after': String(error.retryAfterSeconds || 60) });
    }
  };
}
export const satelliteRoutes = createSatelliteRoutes();
