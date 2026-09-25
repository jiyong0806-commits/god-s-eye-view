import { fetchJson, methodGuard, sendJson } from '../_utils.js';

let cache = null;
let cacheExpiresAt = 0;

export default async function handler(req, res) {
  if (!methodGuard(req, res)) return;
  if (cache && Date.now() < cacheExpiresAt) {
    sendJson(res, 200, cache, { 'cache-control': 's-maxage=8, stale-while-revalidate=20' });
    return;
  }
  try {
    const { response, body } = await fetchJson('https://api.adsb.lol/v2/mil');
    if (!response.ok) {
      sendJson(res, response.status, { error: body?.error || `adsb.lol HTTP ${response.status}`, ac: [] });
      return;
    }
    const payload = body && typeof body === 'object' ? body : { ac: [] };
    cache = payload;
    cacheExpiresAt = Date.now() + 8_000;
    sendJson(res, 200, payload, { 'cache-control': 's-maxage=8, stale-while-revalidate=20' });
  } catch (error) {
    sendJson(res, 502, { error: error?.message || 'adsb.lol proxy failed', ac: [] });
  }
}
