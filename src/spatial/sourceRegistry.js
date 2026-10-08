import { SAFE_DATA_SOURCES } from '../commercialSafeDataRegistry.js';

const definitions = Object.fromEntries(Object.entries(SAFE_DATA_SOURCES).map(([id, value]) => [id, {
  id, name: value.name, provider: value.name, dataTypes: [value.scope], homepage: value.url || '',
  license: { data: value.license, code: null, usage: 'unknown', url: value.url || '' },
  commercialUse: value.commercialUse, attribution: value.attribution,
  updateInterval: null, lastUpdated: null, status: 'offline',
}]));
Object.assign(definitions, {
  'hankyung-rss': {
    id: 'hankyung-rss', name: '한국경제 공식 경제 RSS', provider: '한국경제', dataTypes: ['news-headline'],
    homepage: 'https://www.hankyung.com/feed/economy',
    license: { data: '발행사 저작권 · 제목/링크 확인 범위', code: null, usage: 'restricted', url: 'https://www.hankyung.com/' },
    commercialUse: '기사 본문·사진 재배포 허가 미확인', attribution: '한국경제 공식 RSS',
    updateInterval: 300, lastUpdated: null, status: 'offline',
  },
  'usgs-earthquakes': {
    id: 'usgs-earthquakes', name: 'USGS Earthquake Feed', provider: 'U.S. Geological Survey', dataTypes: ['earthquake'],
    homepage: 'https://earthquake.usgs.gov/earthquakes/feed/',
    license: { data: 'USGS public data (third-party exceptions apply)', code: null, usage: 'attribution-required', url: 'https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits' },
    commercialUse: 'USGS 출처 명시 · 개별 제3자 권리 별도', attribution: 'U.S. Geological Survey',
    updateInterval: 60, lastUpdated: null, status: 'offline',
  },
  'sentinel-2-earth-search': {
    id: 'sentinel-2-earth-search', name: 'Sentinel-2 L2A / Earth Search', provider: 'Copernicus / ESA / Element 84',
    dataTypes: ['satellite-scene', 'thumbnail', 'cog'], homepage: 'https://element84.com/earth-search/',
    license: { data: 'Copernicus Sentinel Data Legal Notice', code: null, usage: 'attribution-required', url: 'https://cds.climate.copernicus.eu/licences/ec-sentinel' },
    commercialUse: '법적 고지 준수 · 출처 표시 · 공급자 공정 사용 한도',
    attribution: 'Contains modified Copernicus Sentinel data [Year] / Earth Search by Element 84',
    updateInterval: null, lastUpdated: null, status: 'offline',
  },
});
export const SOURCE_REGISTRY = Object.freeze(Object.fromEntries(Object.entries(definitions).map(([id, value]) => [id,
  Object.freeze({ ...value, license: Object.freeze(value.license), dataTypes: Object.freeze(value.dataTypes) })])));

export function sourceDefinition(id) {
  const source = Object.hasOwn(SOURCE_REGISTRY, id) ? SOURCE_REGISTRY[id] : null;
  if (!source) throw new Error(`Unregistered source: ${String(id).slice(0, 80)}`);
  return source;
}

export function sourceProvenance(sourceId, { retrievedAt, freshness = 'cached' } = {}) {
  sourceDefinition(sourceId);
  const time = typeof retrievedAt === 'string' ? Date.parse(retrievedAt) : retrievedAt;
  if (!Number.isFinite(time) || time <= 0 || !['live', 'cached', 'stale', 'offline', 'error'].includes(freshness)) throw new Error('Invalid source provenance');
  return { sourceId, retrievedAt: time, freshness };
}

export function sourceUsage(sourceId, { attribution, purpose = 'raster' } = {}) {
  let source;
  try { source = sourceDefinition(sourceId); } catch { return { allowed: false, reason: '등록되지 않은 출처' }; }
  if (purpose === 'metadata') return { allowed: true, reason: '출처 메타데이터 확인 범위' };
  if (['unknown', 'restricted'].includes(source.license.usage)) return { allowed: false, reason: '사용 조건 미확인 또는 별도 허가 필요' };
  if (source.license.usage === 'attribution-required' && !String(attribution || '').trim()) return { allowed: false, reason: '출처 표시 필요' };
  return { allowed: true, reason: '등록된 데이터 사용 조건 적용' };
}

export function sourceState(provenance, now = Date.now()) {
  const source = sourceDefinition(provenance.sourceId);
  if (['offline', 'error', 'stale'].includes(provenance.freshness)) return provenance.freshness;
  if (source.updateInterval && now - provenance.retrievedAt > source.updateInterval * 3000) return 'stale';
  return provenance.freshness;
}
