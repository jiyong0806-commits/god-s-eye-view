import { sourceProvenance, sourceUsage } from '../spatial/sourceRegistry.js';

export const SATELLITE_SOURCE = 'sentinel-2-earth-search';
export const STAC_COLLECTION = 'sentinel-2-l2a';
export const validSceneId = id => typeof id === 'string' && /^S2[A-C]_\d{2}[A-Z]{3}_\d{8}_\d+_L2A$/.test(id);
export function validBounds(bounds, maxSpan = 180) {
  return Array.isArray(bounds) && bounds.length === 4 && bounds.every(Number.isFinite)
    && bounds[0] >= -180 && bounds[2] <= 180 && bounds[1] >= -90 && bounds[3] <= 90
    && bounds[0] < bounds[2] && bounds[1] < bounds[3]
    && bounds[2] - bounds[0] <= maxSpan && bounds[3] - bounds[1] <= maxSpan;
}
export function validateSatelliteSearch(input, now = Date.now()) {
  if (!validBounds(input?.bounds, 2)) throw new Error('검색 범위는 경도·위도 각 2도 이하여야 합니다.');
  const dates = input.dateRange;
  if (!Array.isArray(dates) || dates.length !== 2 || dates.some(date => !/^\d{4}-\d{2}-\d{2}$/.test(date))) throw new Error('촬영 날짜 형식 오류');
  const [start, end] = dates.map(date => Date.parse(`${date}T00:00:00Z`));
  if (!Number.isFinite(start) || !Number.isFinite(end) || dates.some((date, i) => new Date([start, end][i]).toISOString().slice(0, 10) !== date)
    || start > end || end - start > 366 * 86400000 || start < Date.parse('2015-06-23') || end > now) throw new Error('유효한 과거 촬영 기간을 선택하세요. 최대 1년입니다.');
  if (typeof input.maxCloudCover !== 'number' || !Number.isFinite(input.maxCloudCover) || input.maxCloudCover < 0 || input.maxCloudCover > 100) throw new Error('구름 비율 형식 오류');
  return { bounds: input.bounds, dateRange: dates, maxCloudCover: input.maxCloudCover };
}
export function allowedAsset(href) {
  try {
    const url = new URL(href);
    return url.protocol === 'https:' && url.hostname === 'sentinel-cogs.s3.us-west-2.amazonaws.com'
      && !url.username && !url.password && !url.port && !url.search && !url.hash
      && /^\/sentinel-s2-l2a-cogs\/\d{1,2}\/[A-Z]\/[A-Z]{2}\/\d{4}\/\d{1,2}\/S2[A-C]_\d{2}[A-Z]{3}_\d{8}_\d+_L2A\/[A-Za-z0-9_.-]+\.(jpg|tif)$/.test(url.pathname);
  } catch { return false; }
}
export function sceneFromStac(item, now = Date.now()) {
  if (!validSceneId(item?.id) || item.collection !== STAC_COLLECTION || !validBounds(item.bbox)) return null;
  const acquired = Date.parse(item.properties?.datetime);
  if (!Number.isFinite(acquired) || acquired > now + 60000) return null;
  const cloud = item.properties?.['eo:cloud_cover'];
  const assets = Object.entries(item.assets || {}).filter(([, a]) => allowedAsset(a?.href)).slice(0, 32)
    .map(([id, a]) => ({ id, href: a.href, mediaType: typeof a.type === 'string' ? a.type.slice(0, 160) : '',
      resolutionM: typeof a.gsd === 'number' && a.gsd > 0 ? a.gsd : null }));
  const attribution = `Contains modified Copernicus Sentinel data ${new Date(acquired).getUTCFullYear()} / Earth Search by Element 84`;
  return { id: item.id, collectionId: item.collection, acquiredAt: new Date(acquired).toISOString(),
    publishedAt: Number.isFinite(Date.parse(item.properties?.created)) ? item.properties.created : null,
    bounds: item.bbox, cloudCover: typeof cloud === 'number' && cloud >= 0 && cloud <= 100 ? cloud : null,
    assets, attribution, ...sourceProvenance(SATELLITE_SOURCE, { retrievedAt: now, freshness: 'cached' }) };
}
export function previewPermission(scene) {
  const permission = sourceUsage(scene?.sourceId, { attribution: scene?.attribution });
  if (!permission.allowed) return permission;
  return scene.assets?.some(asset => asset.id === 'thumbnail' && asset.mediaType === 'image/jpeg' && allowedAsset(asset.href))
    ? permission : { allowed: false, reason: '호환되는 미리보기 없음 · COG 정밀 지도 오버레이는 아직 미지원' };
}
