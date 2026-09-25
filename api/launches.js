import { fetchJson, methodGuard, sendJson } from './_utils.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res)) return;
  try {
    const url = 'https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=20&mode=detailed';
    const { response, body } = await fetchJson(url);
    sendJson(res, response.ok ? 200 : response.status, body || { results: [] }, {
      'cache-control': 's-maxage=300, stale-while-revalidate=900',
    });
  } catch (error) {
    sendJson(res, 502, { error: error?.message || 'Launch Library proxy failed', results: [] });
  }
}
