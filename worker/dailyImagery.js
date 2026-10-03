import { XMLParser } from 'fast-xml-parser';

export const DAILY_LAYER = 'MODIS_Terra_CorrectedReflectance_TrueColor';
export const DAILY_DOMAIN_URL = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/${DAILY_LAYER}/default/GoogleMapsCompatible_Level9/all/all.xml`;

export function latestImageryDate(xml, now = new Date()) {
  if (typeof xml !== 'string' || xml.length > 65536 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('NASA 날짜 메타데이터 형식 오류');
  const parsed = new XMLParser({ removeNSPrefix: true }).parse(xml);
  const domain = parsed?.Domains?.DimensionDomain?.Domain;
  if (typeof domain !== 'string') throw new Error('NASA 촬영 날짜 정보 없음');
  const today = now.toISOString().slice(0, 10);
  const dates = domain.split(',').map(range => {
    const parts = range.trim().split('/'); return parts.length > 1 ? parts[1] : parts[0];
  }).filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today && new Date(date).toISOString().slice(0, 10) === date);
  if (!dates.length) throw new Error('NASA 유효한 촬영 날짜 없음');
  return dates.sort().at(-1);
}

export async function dailyImagery(fetcher = fetch) {
  try {
    const response = await fetcher(DAILY_DOMAIN_URL, { signal: AbortSignal.timeout(8000), cf: { cacheTtl: 1800, cacheEverything: true } });
    if (!response.ok) return Response.json({ error: `NASA 날짜 조회 HTTP ${response.status}`, provider: 'NASA GIBS' }, { status: 502 });
    const date = latestImageryDate(await response.text());
    return Response.json({ date, layer: DAILY_LAYER, provider: 'NASA GIBS', resolutionMeters: 250, sourceUrl: DAILY_DOMAIN_URL,
      checkedAt: new Date().toISOString(), coverage: '일일 합성 위성영상. 당일 관측은 진행 중일 수 있으며 구름과 미관측 지역이 포함됩니다.' },
    { headers: { 'cache-control': 'public, max-age=1800' } });
  } catch (error) {
    return Response.json({ error: error.name === 'TimeoutError' ? 'NASA 날짜 조회 시간 초과' : 'NASA 날짜 메타데이터 연결 실패', provider: 'NASA GIBS' }, { status: 503 });
  }
}
