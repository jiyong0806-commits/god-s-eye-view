import { fetchJson, methodGuard, sendJson } from './_utils.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res)) return;
  const country = String(req.query?.country || '').trim();
  const search = String(req.query?.search || '').trim();
  const limit = Math.max(1, Math.min(50, Number(req.query?.limit || 25)));
  const params = new URLSearchParams({
    hidebroken: 'true',
    limit: String(limit),
    order: 'clickcount',
    reverse: 'true',
  });
  if (country) params.set('country', country);
  if (search) params.set('name', search);
  const endpoint = search || country ? 'stations/search' : 'stations/topclick';
  try {
    const { response, body } = await fetchJson(`https://de1.api.radio-browser.info/json/${endpoint}?${params}`);
    const stations = Array.isArray(body) ? body : [];
    sendJson(res, response.ok ? 200 : response.status, { stations, count: stations.length }, {
      'cache-control': 's-maxage=300, stale-while-revalidate=900',
    });
  } catch (error) {
    sendJson(res, 502, { error: error?.message || 'Radio Browser proxy failed', stations: [], count: 0 });
  }
}
