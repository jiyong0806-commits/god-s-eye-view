import { fetchJson, methodGuard, sendJson } from './_utils.js';

let token = null;
let tokenExpiresAt = 0;
let cache = null;
let cacheExpiresAt = 0;

async function getOpenSkyToken() {
  const clientId = process.env.OPENSKY_CLIENT_ID || process.env.VITE_OPENSKY_CLIENT_ID || '';
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET || process.env.VITE_OPENSKY_CLIENT_SECRET || '';
  if (!clientId || !clientSecret) return null;
  if (token && Date.now() < tokenExpiresAt - 30_000) return token;

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });
  const { response, body: payload } = await fetchJson('https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok || !payload?.access_token) return null;
  token = payload.access_token;
  tokenExpiresAt = Date.now() + Math.max(60, Number(payload.expires_in || 1800)) * 1000;
  return token;
}

export default async function handler(req, res) {
  if (!methodGuard(req, res)) return;
  if (cache && Date.now() < cacheExpiresAt) {
    sendJson(res, 200, cache.body, cache.headers);
    return;
  }

  try {
    const bearer = await getOpenSkyToken();
    const headers = bearer ? { authorization: `Bearer ${bearer}` } : {};
    const { response, body } = await fetchJson('https://opensky-network.org/api/states/all', { headers });
    if (!response.ok) {
      sendJson(res, response.status, {
        error: body?.error || `OpenSky HTTP ${response.status}`,
        source: 'OpenSky Network',
      }, {
        'x-opensky-auth-mode-used': bearer ? 'oauth' : 'anon',
        'x-opensky-auth-reason': bearer ? 'oauth' : 'no-server-secret',
      });
      return;
    }
    const responseBody = body && typeof body === 'object' ? body : { time: Math.floor(Date.now() / 1000), states: [] };
    const responseHeaders = {
      'cache-control': 's-maxage=8, stale-while-revalidate=20',
      'x-flight-source': 'OpenSky Network',
      'x-flight-coverage': 'worldwide upstream snapshot',
      'x-opensky-auth-mode-used': bearer ? 'oauth' : 'anon',
      'x-opensky-auth-reason': bearer ? 'oauth' : 'no-server-secret',
    };
    cache = { body: responseBody, headers: responseHeaders };
    cacheExpiresAt = Date.now() + 8_000;
    sendJson(res, 200, responseBody, responseHeaders);
  } catch (error) {
    sendJson(res, 502, {
      error: error?.message || 'OpenSky proxy failed',
      source: 'OpenSky Network',
    }, {
      'x-opensky-auth-mode-used': 'unknown',
      'x-opensky-auth-reason': 'proxy-error',
    });
  }
}
