import { fetchJson, methodGuard, sendJson } from '../../_utils.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res)) return;
  const callsign = String(req.query?.callsign || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{2,12}$/.test(callsign)) {
    sendJson(res, 400, { error: 'invalid-callsign' });
    return;
  }
  try {
    const { response, body } = await fetchJson(`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(callsign)}`);
    sendJson(res, response.ok ? 200 : response.status, body || {}, {
      'cache-control': 's-maxage=86400, stale-while-revalidate=604800',
    });
  } catch (error) {
    sendJson(res, 502, { error: error?.message || 'adsbdb route proxy failed' });
  }
}
