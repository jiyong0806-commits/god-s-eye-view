import { cachedProvider, failure, reply, upstream } from './providerRuntime.js';

export function validateRoadQuery(query) {
  const match = /^\[out:json\]\[timeout:(\d+)\];\(way\["highway"~"\^\((motorway\|trunk\|primary\|secondary(?:\|tertiary\|residential\|unclassified)?)\)\$"\]\(([-\d.]+),([-\d.]+),([-\d.]+),([-\d.]+)\);\);out geom qt;$/.exec(query);
  if (!match) return false;
  const [south, west, north, east] = match.slice(3).map(Number);
  return Number(match[1]) <= 25 && Number(match[1]) >= 1 && [south, west, north, east].every(Number.isFinite)
    && south >= -90 && north <= 90 && west >= -180 && east <= 180
    && north > south && east > west && north - south <= 0.25 && east - west <= 0.25;
}
export async function roadRoutes(request, url) {
  if (url.pathname !== '/api/overpass') return null;
  if (request.method !== 'POST') return reply({ error: 'method-not-allowed' }, 405);
  if (request.headers.get('origin') !== url.origin) return reply({ error: 'origin-not-allowed' }, 403);
  if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) return reply({ error: 'form-required' }, 415);
  const reader = request.body?.getReader(); if (!reader) return reply({ error: 'body-required' }, 400);
  let body = ''; const decoder = new TextDecoder(); let size = 0;
  for (;;) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.length;
    if (size > 2048) { await reader.cancel(); return reply({ error: 'body-too-large' }, 413); }
    body += decoder.decode(chunk.value, { stream: true }); }
  body += decoder.decode(); const query = new URLSearchParams(body).get('data') || '';
  if (!validateRoadQuery(query)) return reply({ error: 'bounded-road-query-required' }, 400);
  return cachedProvider(`roads:${query}`, 'OpenStreetMap Overpass', 3600000, async () => {
    const r = await upstream('https://overpass-api.de/api/interpreter', { method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'GODsEyeView/1.0' },
      body: new URLSearchParams({ data: query }) }, 28000);
    if (!r.ok) return failure('OpenStreetMap Overpass', r.status, `도로 데이터 HTTP ${r.status}`, 120);
    const d = await r.json();
    if (!Array.isArray(d.elements) || d.remark) return failure('OpenStreetMap Overpass', 502, '도로 데이터 불완전', 120);
    return reply(d, 200, { 'cache-control': 'public, max-age=3600' });
  });
}
