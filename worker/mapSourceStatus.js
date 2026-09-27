// Publishable, read-only project key; RLS denies writes. Never use a service-role key here.
const DEFAULT_URL = 'https://jjmkhfqxzvhlblmgljwp.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_ycjpP17Icwo7Nfw4Ont5-g_I6QePfcH';

export async function mapSourceStatus(env = {}, fetcher = fetch) {
  const response = await fetcher(`${env.SUPABASE_URL || DEFAULT_URL}/rest/v1/map_source_checks?source=eq.esri-world-imagery&select=source,checked_at,health,service_version,max_tile_level,error`, {
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY || PUBLISHABLE_KEY }, signal: AbortSignal.timeout(8000),
    cf: { cacheTtl: 60, cacheEverything: true },
  });
  if (!response.ok) return Response.json({ error: `지도 상태 DB HTTP ${response.status}` }, { status: 502 });
  const rows = await response.json();
  if (!rows[0]) return Response.json({ error: '지도 공급원 점검 기록 없음' }, { status: 503 });
  return Response.json({ ...rows[0], imageryAcquisitionDate: null, scheduleKst: '01:10',
    scope: '공급원 상태 점검. 항공사진 촬영일 갱신 또는 지역별 타일 품질 보증이 아닙니다.' }, { headers: { 'cache-control': 'public, max-age=60' } });
}
