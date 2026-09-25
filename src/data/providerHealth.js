const records = new Map();
const FEEDS = [
  ['/api/opensky', 'flights', 'adsb.lol'],
  ['/api/adsblol/mil', 'military', 'adsb.lol'],
  ['/api/ais-live', 'ais-live-vessels', 'AISStream'],
  ['/api/celestrak/', 'satellites', 'CelesTrak / SatNOGS'],
  ['/api/firms', 'local-firms', 'NASA FIRMS'],
  ['/api/cctv/sources', 'cctv', 'Caltrans'],
  ['/api/tomtom/status', 'traffic', 'TomTom'],
  ['/api/launches', 'rocket-launches', 'Launch Library 2'],
  ['/api/rainviewer/metadata', 'weather-radar', 'RainViewer'],
];

export function providerHealth(layerId, now = Date.now()) {
  const feed = [...records.values()].filter(row => row.layerId === layerId);
  if (!feed.length) return {};
  const failed = feed.find(row => row.error);
  const row = failed || feed[feed.length - 1];
  return {
    source: row.provider,
    httpStatus: row.httpStatus,
    ...(failed ? { error: row.error, stale: true,
      status: [401, 403, 429, 451].includes(row.httpStatus) ? 'restricted' : 'unavailable',
      retryInSec: Math.max(0, Math.ceil((row.retryAt - now) / 1000)) } : {}),
  };
}

export function installProviderHealth(target = window) {
  const nativeFetch = target.fetch.bind(target);
  target.fetch = async (input, init) => {
    let url;
    try { url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url, target.location.origin); }
    catch { return nativeFetch(input, init); }
    const feed = url.origin === target.location.origin && FEEDS.find(([path]) =>
      path.endsWith('/') ? url.pathname.startsWith(path) : url.pathname === path);
    if (!feed) return nativeFetch(input, init);
    const started = Date.now();
    try {
      const response = await nativeFetch(input, init);
      let error = null;
      if (!response.ok) {
        const body = await response.clone().json().catch(() => null);
        error = String(body?.error || body?.message || `HTTP ${response.status}`).slice(0, 240);
      }
      const retry = response.headers.get('retry-after');
      const seconds = Number(retry);
      records.set(url.pathname, { layerId: feed[1], httpStatus: response.status,
        provider: response.headers.get('x-data-source') || response.headers.get('x-flight-source') ||
          response.headers.get('x-satellite-source') || feed[2], error,
        latencyMs: Date.now() - started,
        retryAt: Number.isFinite(seconds) ? Date.now() + seconds * 1000 : Date.parse(retry) || 0 });
      return response;
    } catch (error) {
      if (error?.name !== 'AbortError') records.set(url.pathname, { layerId: feed[1], provider: feed[2],
        httpStatus: null, error: '네트워크 또는 CORS 연결 실패', retryAt: 0 });
      throw error;
    }
  };
  return () => { target.fetch = nativeFetch; records.clear(); };
}
