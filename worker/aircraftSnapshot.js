export function aircraftCell(url) {
  const lat = Number(url.searchParams.get('lat')), lon = Number(url.searchParams.get('lon'));
  if (!url.searchParams.get('lat')?.trim() || !url.searchParams.get('lon')?.trim() || !Number.isFinite(lat) || !Number.isFinite(lon)
    || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat: lat.toFixed(1), lon: lon.toFixed(1) };
}

// A successful detached snapshot is shared across Worker isolates in one edge location.
export async function edgeAircraftSnapshot(key, load, cache = globalThis.caches?.default) {
  if (!cache) return load();
  const request = new Request(`https://gev-cache.invalid/aircraft/${encodeURIComponent(key)}`);
  try {
    const hit = await cache.match(request);
    if (hit) { const headers = new Headers(hit.headers); headers.set('x-flight-cache', 'edge'); return new Response(hit.body, { status: hit.status, headers }); }
  } catch { /* cache failure must not take the provider down */ }
  const response = await load();
  if (response.ok) {
    try {
      const headers = new Headers(response.headers); headers.set('cache-control', 'public, max-age=30');
      await cache.put(request, new Response(response.clone().body, { status: response.status, headers }));
    } catch { /* preserve the original response */ }
  }
  return response;
}
