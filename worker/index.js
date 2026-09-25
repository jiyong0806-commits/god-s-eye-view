import { filterTrailing24h, parseFirmsCsv } from '../src/data/firmsCsv.js';
import { extraRoutes } from './extraRoutes.js';
import { flowRoutes } from './flowRoutes.js';
import { cachedProvider, failure, reserveBudget, retrySeconds } from './providerRuntime.js';

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };
const GBFS_HOSTS = new Set(['gbfs.lyft.com', 'gbfs.bluebikes.com', 'gbfs.bcycle.com', 'gbfs.biketownpdx.com', 'gbfs.cogobikeshare.com']);
let tokenCache = { value: null, expires: 0 };
let satnogsCache = { rows: null, expires: 0, pending: null };
let militaryCache = { payload: null, expires: 0, pending: null, retryAt: 0 };
const regionalFlightCache = new Map();
let firmsCache = { payload: null, expires: 0, pending: null };

async function handleFirms(env, pathname) {
  const key = String(env.FIRMS_MAP_KEY || '').trim();
  if (pathname === '/api/firms/status') {
    return json({ hasKey: Boolean(key), lastFetch: firmsCache.payload?.fetchedAt ?? null,
      count: firmsCache.payload?.count ?? null, stale: firmsCache.expires <= Date.now(), ttlMs: 1800000 });
  }
  if (!key) return json({ error: 'no_key' }, 503);
  if (firmsCache.payload && firmsCache.expires > Date.now()) return json(firmsCache.payload);
  if (!firmsCache.pending) {
    firmsCache.pending = (async () => {
      const sources = [];
      const fires = [];
      const now = Date.now();
      for (const source of ['VIIRS_NOAA20_NRT']) {
        try {
          const upstream = await fetchWithTimeout(
            `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(key)}/${source}/world/2`,
            { headers: { accept: 'text/csv' }, cf: { cacheTtl: 1800, cacheEverything: true } }, 60000,
          );
          if (!upstream.ok) throw new Error(`HTTP ${upstream.status}`);
          const records = parseFirmsCsv(await upstream.text());
          if (!records) throw new Error('Invalid FIRMS CSV');
          const recent = filterTrailing24h(records, now);
          sources.push({ source, count: recent.length, ok: true });
          for (const record of recent) fires.push(record);
        } catch (error) {
          console.warn('[firms-feed] source unavailable', source, error?.name || 'error');
          sources.push({ source, count: 0, ok: false });
        }
      }
      if (!sources.some((source) => source.ok)) return null;
      const totalDetected = fires.length;
      if (fires.length > 20000) {
        fires.sort((a, b) => b.frp - a.frp);
        fires.length = 20000;
      }
      const payload = { fetchedAt: now, stale: false, ttlMs: 1800000, sources,
        count: fires.length, totalDetected, truncated: totalDetected > fires.length, fires };
      firmsCache = { payload, expires: Date.now() + 1800000, pending: null };
      return payload;
    })().finally(() => { firmsCache.pending = null; });
  }
  const payload = await firmsCache.pending;
  if (payload) return json(payload);
  if (firmsCache.payload) {
    const fires = filterTrailing24h(firmsCache.payload.fires, Date.now());
    return json({ ...firmsCache.payload, stale: true, count: fires.length, fires });
  }
  return json({ error: 'firms fetch failed and no cache available' }, 502);
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, 'cache-control': 'no-store', ...headers },
  });
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function openSkyToken(env) {
  if (!env.OPENSKY_CLIENT_ID || !env.OPENSKY_CLIENT_SECRET) return null;
  if (tokenCache.expires > Date.now()) return tokenCache.value;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: env.OPENSKY_CLIENT_ID,
    client_secret: env.OPENSKY_CLIENT_SECRET,
  });
  const response = await fetchWithTimeout(
    'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token',
    { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body },
  );
  if (!response.ok) return null;
  const data = await response.json();
  tokenCache = { value: data.access_token || null, expires: Date.now() + Math.max(0, Number(data.expires_in || 300) - 60) * 1000 };
  return tokenCache.value;
}

function adsbLolToOpenSky(payload) {
  const sourceTime = Number(payload?.now);
  const nowSeconds = Number.isFinite(sourceTime) && sourceTime > 0
    ? Math.floor(sourceTime > 10_000_000_000 ? sourceTime / 1000 : sourceTime)
    : Math.floor(Date.now() / 1000);
  const states = (Array.isArray(payload?.ac) ? payload.ac : []).flatMap((aircraft) => {
    const lat = Number(aircraft.lat);
    const lon = Number(aircraft.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !aircraft.hex) return [];
    const finite = (value) => value === null || value === undefined || value === '' ? null : (Number.isFinite(Number(value)) ? Number(value) : null);
    const feetToMetres = (value) => finite(value) === null ? null : finite(value) * 0.3048;
    const knotsToMps = (value) => finite(value) === null ? null : finite(value) * 0.514444;
    const feetMinuteToMps = (value) => finite(value) === null ? null : finite(value) * 0.00508;
    const category = { A1: 2, A2: 3, A3: 4, A4: 5, A5: 6, A6: 7, A7: 8, B1: 9, B2: 10, B3: 11, B4: 12, B6: 14, B7: 15 }[String(aircraft.category || '').toUpperCase()] || 0;
    const seenPosition = Math.max(0, finite(aircraft.seen_pos) ?? finite(aircraft.seen) ?? 0);
    const seen = Math.max(0, finite(aircraft.seen) ?? seenPosition);
    return [[
      String(aircraft.hex).toLowerCase(), String(aircraft.flight || aircraft.r || '').trim(),
      null, nowSeconds - seenPosition, nowSeconds - seen,
      lon, lat, aircraft.alt_baro === 'ground' ? null : feetToMetres(aircraft.alt_baro), aircraft.alt_baro === 'ground',
      knotsToMps(aircraft.gs), finite(aircraft.track),
      feetMinuteToMps(aircraft.baro_rate ?? aircraft.geom_rate), null, feetToMetres(aircraft.alt_geom),
      aircraft.squawk || null, aircraft.spi === 1, 0, category,
    ]];
  });
  return { time: nowSeconds, states };
}

async function handleOpenSky(url, env) {
  const lat = url.searchParams.has('lat') ? Number(url.searchParams.get('lat')) : NaN;
  const lon = url.searchParams.has('lon') ? Number(url.searchParams.get('lon')) : NaN;
  const box = Number.isFinite(lat) && Number.isFinite(lon)
    ? `&lamin=${Math.max(-90, lat - 5).toFixed(2)}&lamax=${Math.min(90, lat + 5).toFixed(2)}&lomin=${Math.max(-180, lon - 7).toFixed(2)}&lomax=${Math.min(180, lon + 7).toFixed(2)}`
    : '';
  const licensed = env.GEV_OPENSKY_LICENSED === '1';
  const token = licensed ? await openSkyToken(env).catch(() => null) : null;
  const response = licensed ? await fetchWithTimeout(`https://opensky-network.org/api/states/all?extended=1${box}`, {
    headers: token ? { authorization: `Bearer ${token}`, accept: 'application/json' } : { accept: 'application/json' },
    cf: { cacheTtl: 8, cacheEverything: true },
  }).catch(() => null) : null;
  if (response?.ok) {
    return new Response(response.body, {
      status: 200,
      headers: {
        ...JSON_HEADERS,
        'cache-control': 'public, max-age=5, s-maxage=8, stale-while-revalidate=25',
        'x-flight-source': 'OpenSky Network',
        'x-flight-coverage': 'worldwide live snapshot',
        'x-opensky-auth-mode-used': token ? 'oauth' : 'anon',
      },
    });
  }

  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    const key = `${lat.toFixed(1)},${lon.toFixed(1)}`;
    const now = Date.now();
    let entry = regionalFlightCache.get(key);
    if (!entry || (entry.expires <= now && entry.retryAt <= now && !entry.pending)) {
      entry = { payload: null, expires: 0, retryAt: 0, pending: null };
      regionalFlightCache.set(key, entry);
      if (regionalFlightCache.size > 64) regionalFlightCache.delete(regionalFlightCache.keys().next().value);
    }
    if (!entry.payload && entry.retryAt > now) {
      return json({ error: 'Regional aircraft feed rate limited' }, 429, {
        'retry-after': String(Math.ceil((entry.retryAt - now) / 1000)),
        'x-flight-source': 'adsb.lol',
      });
    }
    if (entry.expires <= now && !entry.pending) {
      entry.pending = (async () => {
        const fallback = await fetchWithTimeout(`https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/250`, {
          headers: { accept: 'application/json', 'user-agent': 'GODsEyeView/1.0 (+https://godseyeview.jiyong0806.chatgpt.site/)' },
          cf: { cacheTtl: 8, cacheEverything: true },
        }).catch(() => null);
        if (fallback?.ok) {
          entry.payload = adsbLolToOpenSky(await fallback.json());
          entry.expires = Date.now() + 15000;
          return;
        }
        if (fallback?.status === 429) {
          entry.retryAt = Date.now() + retrySeconds(fallback.headers.get('retry-after')) * 1000;
        }
        console.warn('[flight-feed] regional upstream unavailable', fallback?.status || 'network-error');
      })().finally(() => { entry.pending = null; });
    }
    if (entry.pending) await entry.pending;
    if (entry.payload) {
      return json(entry.payload, 200, {
        'cache-control': 'public, max-age=5, s-maxage=8',
        'x-flight-source': 'adsb.lol',
        'x-flight-coverage': '250nm regional live fallback',
        'x-opensky-auth-mode-used': licensed ? (token ? 'oauth-failed' : 'anon-failed') : 'license-not-configured',
      });
    }
    if (entry.retryAt > Date.now()) {
      return json({ error: 'Regional aircraft feed rate limited' }, 429, {
        'retry-after': String(Math.ceil((entry.retryAt - Date.now()) / 1000)),
        'x-flight-source': 'adsb.lol',
      });
    }
  }
  return json({ time: Math.floor(Date.now() / 1000), states: [], error: 'Live aircraft feeds unavailable' }, 503);
}

async function handleMilitaryFlights() {
  const now = Date.now();
  if (militaryCache.payload && militaryCache.expires > now) {
    return json(militaryCache.payload, 200, { 'cache-control': 'public, max-age=5, s-maxage=12', 'x-flight-source': 'adsb.lol' });
  }
  if (militaryCache.retryAt > now) {
    const retrySeconds = Math.ceil((militaryCache.retryAt - now) / 1000);
    return json({ error: 'adsb.lol rate limited', retryInSec: retrySeconds }, 429, {
      'retry-after': String(retrySeconds),
    });
  }
  if (!militaryCache.pending) {
    militaryCache.pending = (async () => {
      const response = await fetchWithTimeout('https://api.adsb.lol/v2/mil', {
        headers: { accept: 'application/json', 'user-agent': 'GODsEyeView/1.0 (+https://godseyeview.jiyong0806.chatgpt.site/)' },
        cf: { cacheTtl: 12, cacheEverything: true },
      }, 10000);
      if (response.status === 429) {
        const retry = retrySeconds(response.headers.get('retry-after'), 120);
        militaryCache.retryAt = Date.now() + retry * 1000;
        return { status: 429, error: 'adsb.lol rate limited', retrySeconds: retry };
      }
      if (!response.ok) return { status: response.status, error: `adsb.lol HTTP ${response.status}` };
      const payload = await response.json();
      if (!payload || !Array.isArray(payload.ac)) return { status: 502, error: 'Invalid aircraft feed' };
      const ac = payload.ac.filter((row) => row && typeof row.hex === 'string' &&
        row.lat != null && row.lon != null && Number.isFinite(Number(row.lat)) &&
        Number.isFinite(Number(row.lon)) && Math.abs(Number(row.lat)) <= 90 &&
        Math.abs(Number(row.lon)) <= 180).slice(0, 3000);
      militaryCache.payload = { ...payload, ac };
      militaryCache.expires = Date.now() + 12000;
      militaryCache.retryAt = 0;
      return { status: 200, payload: militaryCache.payload };
    })().finally(() => { militaryCache.pending = null; });
  }
  const result = await militaryCache.pending;
  if (result.status !== 200) return json({ error: result.error }, result.status,
    result.retrySeconds ? { 'retry-after': String(result.retrySeconds) } : {});
  return json(result.payload, 200, { 'cache-control': 'public, max-age=5, s-maxage=12', 'x-flight-source': 'adsb.lol' });
}

async function loadSatnogsTles() {
  if (satnogsCache.rows && satnogsCache.expires > Date.now()) return satnogsCache.rows;
  if (!satnogsCache.pending) {
    satnogsCache.pending = (async () => {
      const response = await fetchWithTimeout('https://db.satnogs.org/api/tle/', {
        headers: { accept: 'application/json', 'user-agent': 'GODsEyeView/1.0 (+https://godseyeview.jiyong0806.chatgpt.site/)' },
        cf: { cacheTtl: 7200, cacheEverything: true },
      }, 18000);
      if (!response.ok) throw new Error(`SatNOGS HTTP ${response.status}`);
      const rows = await response.json();
      if (!Array.isArray(rows) || !rows.length) throw new Error('SatNOGS returned no TLE rows');
      satnogsCache = { rows, expires: Date.now() + 2 * 60 * 60 * 1000, pending: null };
      return rows;
    })().finally(() => { satnogsCache.pending = null; });
  }
  return satnogsCache.pending;
}

function satnogsGroup(row) {
  const name = String(row.tle0 || '').replace(/^0\s+/, '').toUpperCase();
  const meanMotion = Number(String(row.tle2 || '').slice(52, 63).trim());
  if (/\b(ISS|TIANGONG|CSS)\b/.test(name)) return 'stations';
  if (/\b(GPS|NAVSTAR)\b/.test(name)) return 'gps-ops';
  if (/\bGLONASS\b/.test(name)) return 'glo-ops';
  if (/\b(GALILEO|GSAT)\b/.test(name)) return 'galileo';
  if (/\bSTARLINK\b/.test(name)) return 'starlink';
  if (meanMotion > 0.8 && meanMotion < 1.2) return 'geo';
  return 'visual';
}

async function handleCelesTrak(pathname) {
  const group = (pathname.split('/').pop() || 'stations').replace(/[^a-z0-9-]/gi, '');
  if (!new Set(['stations', 'visual', 'gps-ops', 'glo-ops', 'galileo', 'geo', 'starlink']).has(group)) {
    return new Response('Unknown satellite group', { status: 400 });
  }
  const upstream = await fetchWithTimeout(`https://celestrak.org/NORAD/elements/gp.php?GROUP=${encodeURIComponent(group)}&FORMAT=tle`, {
    headers: { accept: 'text/plain', 'user-agent': 'GODsEyeView/1.0' },
    cf: { cacheTtl: 7200, cacheEverything: true },
  }, 12000).catch(() => null);
  if (upstream?.ok) {
    return new Response(upstream.body, {
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=7200, s-maxage=7200', 'x-satellite-source': 'CelesTrak' },
    });
  }
  console.warn('[satellite-feed] CelesTrak unavailable, using SatNOGS', upstream?.status || 'network-error');
  const rows = await loadSatnogsTles();
  const text = rows
    .filter((row) => row.tle1?.startsWith('1 ') && row.tle2?.startsWith('2 ') && satnogsGroup(row) === group)
    .map((row) => `${String(row.tle0 || '').replace(/^0\s+/, '')}\n${row.tle1}\n${row.tle2}`)
    .join('\n');
  return new Response(text, {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=7200, s-maxage=7200', 'x-satellite-source': 'SatNOGS DB', 'x-satellite-license': 'CC BY-SA 4.0' },
  });
}

function nominatimTypes(place) {
  const type = String(place?.type || '').toLowerCase();
  const category = String(place?.category || '').toLowerCase();
  if (['country', 'state', 'province', 'region'].includes(type)) return ['country', 'political'];
  if (['city', 'town', 'village', 'municipality', 'county'].includes(type)) return ['locality', 'political'];
  if (['road', 'street', 'highway'].includes(type) || category === 'highway') return ['route'];
  if (['park', 'nature_reserve'].includes(type)) return ['park'];
  return ['point_of_interest', 'establishment'];
}

async function handleGeocode(url) {
  const query = String(url.searchParams.get('q') || url.searchParams.get('address') || '').trim();
  if (!query || query.length > 160) return json({ status: 'INVALID_REQUEST', results: [] }, 400);
  const upstreamUrl = new URL('https://nominatim.openstreetmap.org/search');
  upstreamUrl.searchParams.set('q', query);
  upstreamUrl.searchParams.set('format', 'jsonv2');
  upstreamUrl.searchParams.set('addressdetails', '1');
  upstreamUrl.searchParams.set('limit', '5');
  upstreamUrl.searchParams.set('accept-language', 'ko,en');
  const response = await fetchWithTimeout(upstreamUrl, {
    headers: { accept: 'application/json', 'user-agent': 'GODsEyeView/1.0 (https://godseyeview.jiyong0806.chatgpt.site/)', referer: 'https://godseyeview.jiyong0806.chatgpt.site/' },
    cf: { cacheTtl: 86400, cacheEverything: true },
  });
  if (!response.ok) return json({ status: 'ERROR', results: [] }, response.status);
  const places = await response.json();
  const results = places.map((place) => {
    const bounds = Array.isArray(place.boundingbox) ? place.boundingbox.map(Number) : [];
    const viewport = bounds.length === 4 ? {
      southwest: { lat: bounds[0], lng: bounds[2] },
      northeast: { lat: bounds[1], lng: bounds[3] },
    } : null;
    return {
      formatted_address: place.display_name,
      types: nominatimTypes(place),
      geometry: {
        location: { lat: Number(place.lat), lng: Number(place.lon) },
        viewport,
        bounds: viewport,
      },
      source: 'OpenStreetMap Nominatim',
    };
  });
  return json({ status: results.length ? 'OK' : 'ZERO_RESULTS', results }, 200, {
    'cache-control': 'public, max-age=3600, s-maxage=86400',
    'x-geocoder-source': 'OpenStreetMap Nominatim',
  });
}

async function proxyJson(upstreamUrl, ttl = 300) {
  const response = await fetchWithTimeout(upstreamUrl, {
    headers: { accept: 'application/json', 'user-agent': 'GODsEyeView/1.0' },
    cf: { cacheTtl: ttl, cacheEverything: true },
  });
  if (!response.ok) return json({ error: `Upstream HTTP ${response.status}` }, response.status);
  return new Response(response.body, {
    headers: { ...JSON_HEADERS, 'cache-control': `public, max-age=${Math.min(ttl, 300)}, s-maxage=${ttl}` },
  });
}

async function handleGbfs(request, url) {
  if (request.method !== 'GET') return json({ error: 'method-not-allowed' }, 405);
  let target;
  try {
    const encoded = url.pathname.slice('/api/gbfs/'.length);
    target = new URL(decodeURIComponent(encoded));
  } catch {
    return json({ error: 'invalid-target' }, 400);
  }
  const host = target.hostname.toLowerCase();
  if (target.protocol !== 'https:' || target.username || target.password || target.port ||
      !(GBFS_HOSTS.has(host) || host.endsWith('.publicbikesystem.net')) ||
      !/\/station_(information|status)\.json$/i.test(target.pathname) || target.search || target.hash) {
    return json({ error: 'target-not-allowed' }, 400);
  }
  const response = await fetchWithTimeout(target.href, { headers: { accept: 'application/json' } }, 12000);
  if (!response.ok) return json({ error: `GBFS HTTP ${response.status}` }, response.status);
  const raw = await response.arrayBuffer();
  if (raw.byteLength > 5 * 1024 * 1024) return json({ error: 'GBFS response too large' }, 502);
  JSON.parse(new TextDecoder().decode(raw));
  const ttl = /station_information\.json$/i.test(target.pathname) ? 300 : 15;
  return new Response(raw, { headers: { ...JSON_HEADERS, 'cache-control': `public, max-age=${ttl}, s-maxage=${ttl}`, 'x-data-source': 'GBFS' } });
}

async function handleApi(request, env, url) {
  const flow = await flowRoutes(request, env);
  if (flow) return flow;
  const extra = await extraRoutes(request, env, url);
  if (extra) return extra;
  if (url.pathname === '/api/ais-live' || url.pathname === '/api/ais-live/track') {
    return json({ status: 'unsupported', error: 'AISStream persistent backend is not configured on this host',
      rows: [], count: 0 }, 503, { 'retry-after': '900' });
  }
  if (url.pathname === '/api/firms' || url.pathname === '/api/firms/status') return handleFirms(env, url.pathname);
  if (url.pathname === '/api/opensky') return cachedProvider(`flights:${url.search}`, 'adsb.lol', 15000, () => handleOpenSky(url, env));
  if (url.pathname === '/api/adsblol/mil') return cachedProvider('military', 'adsb.lol', 15000, () => handleMilitaryFlights());
  if (url.pathname.startsWith('/api/celestrak/')) return handleCelesTrak(url.pathname);
  if (url.pathname === '/api/geocode') return handleGeocode(url);
  if (url.pathname.startsWith('/api/gbfs/')) return handleGbfs(request, url);
  if (url.pathname === '/api/rainviewer/metadata') {
    if (env.GEV_RAINVIEWER_PERMITTED !== '1') return failure('RainViewer', 451, '공개 서비스 사용 조건 확인 필요', 3600);
    return proxyJson('https://api.rainviewer.com/public/weather-maps.json', 300);
  }
  if (url.pathname === '/api/gdacs/alerts') {
    const response = await fetchWithTimeout('https://www.gdacs.org/xml/rss.xml', {
      headers: { accept: 'application/xml', 'user-agent': 'GODsEyeView/1.0' },
      cf: { cacheTtl: 300, cacheEverything: true },
    });
    return new Response(response.body, {
      status: response.status,
      headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=60, s-maxage=300' },
    });
  }
  if (url.pathname === '/api/elevenlabs/tts') {
    if (request.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);
    if (env.GEV_TTS_ENABLED !== '1' || !env.PROVIDER_DB?.prepare) return json({ error: 'TTS disabled until server-side quota is configured' }, 503);
    if (!env.ELEVENLABS_API_KEY || !env.ELEVENLABS_VOICE_ID) return json({ error: 'TTS not configured' }, 503);
    const input = await request.json().catch(() => ({}));
    const text = String(input.text || '').trim().slice(0, 900);
    if (!text) return json({ error: 'Text is required' }, 400);
    if (request.headers.get('origin') !== url.origin) return json({ error: 'origin-not-allowed' }, 403);
    if (!await reserveBudget(env, 'elevenlabs')) return failure('ElevenLabs', 429, '음성 일일 사용 한도에 도달했습니다.', 3600);
    const upstream = await fetchWithTimeout(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(env.ELEVENLABS_VOICE_ID)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'audio/mpeg', 'xi-api-key': env.ELEVENLABS_API_KEY },
      body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2', language_code: 'ko' }),
    }, 20000);
    if (!upstream.ok) return json({ error: 'TTS upstream failed' }, upstream.status);
    return new Response(upstream.body, { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'private, no-store' } });
  }
  return json({ error: 'not-found', path: url.pathname }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/event') {
      url.pathname = '/event/';
      return Response.redirect(url, 308);
    }
    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env, url);
      } catch (error) {
        return json({ error: error?.name === 'AbortError' ? 'upstream-timeout' : 'proxy-failed' }, 502);
      }
    }
    if (['/', '/home', '/home/', '/map', '/map/'].includes(url.pathname)) {
      const assetUrl = new URL(url);
      assetUrl.pathname = url.pathname.startsWith('/map') ? '/index.html' : '/home/index.html';
      const asset = await env.ASSETS.fetch(new Request(assetUrl, request));
      const headers = new Headers(asset.headers);
      headers.set('cache-control', 'no-cache');
      return new Response(asset.body, { status: asset.status, headers });
    }
    const response = await env.ASSETS.fetch(request);
    const acceptsHtml = request.headers.get('accept')?.includes('text/html');
    if (response.status !== 404 || !acceptsHtml || !['GET', 'HEAD'].includes(request.method)) return response;
    const indexUrl = new URL(request.url);
    indexUrl.pathname = '/index.html';
    indexUrl.search = '';
    return env.ASSETS.fetch(new Request(indexUrl, request));
  },
};
