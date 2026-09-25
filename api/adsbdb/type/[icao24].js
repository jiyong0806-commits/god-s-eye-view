import { fetchJson, methodGuard, sendJson } from '../../_utils.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res)) return;
  const icao24 = String(req.query?.icao24 || '').trim().toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(icao24)) {
    sendJson(res, 400, { error: 'invalid-icao24' });
    return;
  }
  try {
    const { response, body } = await fetchJson(`https://api.adsbdb.com/v0/aircraft/${icao24}`);
    sendJson(res, response.ok ? 200 : response.status, body || {}, {
      'cache-control': 's-maxage=86400, stale-while-revalidate=604800',
    });
  } catch (error) {
    sendJson(res, 502, { error: error?.message || 'adsbdb type proxy failed' });
  }
}
