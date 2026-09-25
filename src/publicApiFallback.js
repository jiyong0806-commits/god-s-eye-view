const FALLBACK_HEADER = 'x-gev-public-fallback';

function isPublicStaticHost() {
  return typeof window !== 'undefined'
    && /\.chatgpt\.site$/i.test(window.location.hostname)
    && !import.meta.env.DEV;
}

function json(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status || 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      [FALLBACK_HEADER]: '1',
      ...init.headers,
    },
  });
}

function text(body, init = {}) {
  return new Response(body, {
    status: init.status || 200,
    headers: {
      'content-type': init.contentType || 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      [FALLBACK_HEADER]: '1',
      ...init.headers,
    },
  });
}

function apiPath(input) {
  try {
    const url = new URL(typeof input === 'string' ? input : input?.url, window.location.origin);
    if (url.origin !== window.location.origin) return '';
    return url.pathname;
  } catch {
    return '';
  }
}

async function externalJson(nativeFetch, url, fallbackBody, headers = {}) {
  try {
    const response = await nativeFetch(url, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) return json({ ...fallbackBody, upstreamStatus: response.status, fallback: true }, { status: 200, headers });
    const body = await response.json();
    return json(body, { headers });
  } catch (error) {
    return json({
      ...fallbackBody,
      error: error?.message || 'external fetch failed',
      fallback: true,
    }, { status: 200, headers });
  }
}

async function externalText(nativeFetch, url, fallbackBody) {
  try {
    const response = await nativeFetch(url, { cache: 'no-store' });
    if (!response.ok) return text(fallbackBody);
    return text(await response.text());
  } catch {
    return text(fallbackBody);
  }
}

function queryString(input) {
  try {
    const url = new URL(typeof input === 'string' ? input : input?.url, window.location.origin);
    return url.searchParams;
  } catch {
    return new URLSearchParams();
  }
}

async function fallbackResponse(input, nativeFetch) {
  const path = apiPath(input);
  if (!path.startsWith('/api/')) return null;

  if (path === '/api/setup/status') {
    return json({ ok: true, external: true, providers: {}, fallback: true });
  }

  if (path === '/api/setup/keys') {
    return json({ ok: false, saved: false, error: '공개 사이트에서는 키 저장을 막았습니다.', fallback: true });
  }

  if (path.startsWith('/api/opensky')) {
    return externalJson(
      nativeFetch,
      'https://opensky-network.org/api/states/all',
      { time: Math.floor(Date.now() / 1000), states: [], source: 'OpenSky direct fallback' },
      {
        'x-flight-source': 'OpenSky Network',
        'x-flight-coverage': 'worldwide direct browser fallback',
        'x-opensky-auth-mode-used': 'anon',
        'x-opensky-auth-reason': 'static-site-direct',
      },
    );
  }

  if (path.startsWith('/api/adsblol/mil')) {
    return externalJson(
      nativeFetch,
      'https://api.adsb.lol/v2/mil',
      { now: Date.now() / 1000, total: 0, ac: [], source: 'adsb.lol direct fallback' },
    );
  }

  if (path.startsWith('/api/adsblol') || path.startsWith('/api/adsbdb')) {
    return json({
      now: Date.now() / 1000,
      total: 0,
      ac: [],
      response: {},
      source: 'public-static-fallback',
      fallback: true,
    });
  }

  if (path.startsWith('/api/ais-live')) {
    return json({
      status: 'ok',
      vessels: [],
      count: 0,
      source: 'public-static-fallback',
      fallback: true,
    });
  }

  if (path.startsWith('/api/celestrak')) {
    return externalText(nativeFetch, 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle', [
      'ISS (ZARYA)',
      '1 25544U 98067A   26254.50000000  .00012000  00000+0  22000-3 0  9990',
      '2 25544  51.6400 120.0000 0004000  80.0000 280.0000 15.50000000400000',
    ].join('\n'));
  }

  if (path.startsWith('/api/launches')) {
    return externalJson(
      nativeFetch,
      'https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=20&mode=detailed',
      { results: [], count: 0 },
    );
  }
  if (path.startsWith('/api/firms')) return json({ fires: [], sources: [], count: 0, fallback: true });
  if (path.startsWith('/api/tomtom/status')) return json({ hasKey: false, dailyCount: 0, budget: 0, fallback: true });
  if (path.startsWith('/api/tomtom/flow/')) return new Response(new Uint8Array(), { status: 204, headers: { [FALLBACK_HEADER]: '1' } });
  if (path.startsWith('/api/cctv')) return json({ cameras: [], sources: [], health: [], count: 0, fallback: true });
  if (path.startsWith('/api/radio')) {
    const params = queryString(input);
    const limit = Math.max(1, Math.min(50, Number(params.get('limit') || 25)));
    const search = String(params.get('search') || params.get('name') || '').trim();
    const country = String(params.get('country') || '').trim();
    const upstream = new URL(search || country
      ? 'https://de1.api.radio-browser.info/json/stations/search'
      : 'https://de1.api.radio-browser.info/json/stations/topclick');
    upstream.searchParams.set('hidebroken', 'true');
    upstream.searchParams.set('limit', String(limit));
    upstream.searchParams.set('order', 'clickcount');
    upstream.searchParams.set('reverse', 'true');
    if (search) upstream.searchParams.set('name', search);
    if (country) upstream.searchParams.set('country', country);
    const response = await externalJson(nativeFetch, upstream.toString(), []);
    try {
      const stations = await response.clone().json();
      if (Array.isArray(stations)) return json({ stations, count: stations.length, source: 'Radio Browser direct fallback' });
    } catch {
      // keep original response if it already has the expected object shape.
    }
    return response;
  }
  if (path.startsWith('/api/gbfs/')) return json({ ttl: 60, last_updated: Math.floor(Date.now() / 1000), data: { stations: [], bikes: [] }, fallback: true });
  if (path.startsWith('/api/military-installations')) return json({ installations: [], features: [], count: 0, fallback: true });
  if (path.startsWith('/api/acled/events')) return json({ events: [], features: [], count: 0, fallback: true });
  if (path.startsWith('/api/overpass')) return json({ elements: [], fallback: true });
  if (path.startsWith('/api/route')) return json({ ok: true, routes: [], geometry: null, fallback: true });
  if (path.startsWith('/api/weather-effects')) return json({ temperatureC: 20, windSpeedMps: 2, weatherCode: 0, cloudCover: 0, fallback: true });
  if (path.startsWith('/api/regional-brief')) return json({ place: null, weather: null, articles: [], fallback: true });
  if (path.startsWith('/api/terrain/heights')) return json({ results: [], fallback: true });
  if (path.startsWith('/api/google/')) return json({ status: 'OK', results: [], candidates: [], fallback: true });
  if (path.startsWith('/api/openrouter/chat')) return json({ ok: true, text: '공개 사이트에서는 브라우저 음성 인식만 사용합니다.', fallback: true });
  if (path.startsWith('/api/openai/hud-summary')) return json({ summary: '공개 안전 모드', fallback: true });
  if (path.startsWith('/api/realtime/')) return json({ ok: false, error: '공개 사이트에서는 실시간 음성 토큰을 비활성화했습니다.', fallback: true });

  return json({ ok: false, path, fallback: true });
}

export function installPublicApiFallback() {
  if (!isPublicStaticHost() || window.__gevPublicApiFallbackInstalled) return;
  window.__gevPublicApiFallbackInstalled = true;
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const fallback = await fallbackResponse(input, nativeFetch);
    if (fallback) return fallback;
    return nativeFetch(input, init);
  };
}
