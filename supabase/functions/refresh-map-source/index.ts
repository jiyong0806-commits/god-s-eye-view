const ESRI_METADATA = 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer?f=pjson';
const SOURCE = 'esri-world-imagery';

const respond = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return respond({ error: 'method-not-allowed' }, 405);
  const projectUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!projectUrl || !serviceKey) return respond({ error: 'server-not-configured' }, 503);

  const tableUrl = `${projectUrl}/rest/v1/map_source_checks`;
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  const previousResponse = await fetch(`${tableUrl}?source=eq.${SOURCE}&select=*`, { headers });
  if (!previousResponse.ok) return respond({ error: 'status-read-failed' }, 502);
  const previous = (await previousResponse.json())[0];
  if (previous && Date.now() - Date.parse(previous.checked_at) < 20 * 60 * 60 * 1000) {
    return respond({ ...previous, refreshed: false, imageryAcquisitionDate: null });
  }

  let row: Record<string, unknown>;
  try {
    const response = await fetch(ESRI_METADATA, { signal: AbortSignal.timeout(10000), headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const metadata = await response.json();
    const lods = metadata?.tileInfo?.lods;
    if (!Array.isArray(lods) || !lods.length || !Number.isFinite(metadata.currentVersion)) throw new Error('invalid-metadata');
    row = { source: SOURCE, checked_at: new Date().toISOString(), health: 'available',
      service_version: String(metadata.currentVersion), max_tile_level: Math.max(...lods.map((lod: { level: number }) => lod.level)), error: null };
  } catch (error) {
    row = { source: SOURCE, checked_at: new Date().toISOString(), health: 'unavailable',
      service_version: previous?.service_version ?? null, max_tile_level: previous?.max_tile_level ?? null,
      error: String(error instanceof Error ? error.message : 'metadata-fetch-failed').slice(0, 120) };
  }

  const saved = await fetch(`${tableUrl}?on_conflict=source`, {
    method: 'POST', headers: { ...headers, 'content-type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(row),
  });
  if (!saved.ok) return respond({ error: 'status-write-failed' }, 502);
  return respond({ ...(await saved.json())[0], refreshed: true, imageryAcquisitionDate: null });
});
