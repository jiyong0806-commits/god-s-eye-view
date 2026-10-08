import { validateSatelliteSearch, validSceneId } from './model.js';

export function createSatelliteProvider(fetcher = fetch) {
  async function get(path, signal) {
    const response = await fetcher(path, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) });
    const data = await response.json();
    if (!response.ok) throw new Error(`${data.error || `HTTP ${response.status}`}${data.retryAfterSeconds ? ` · ${data.retryAfterSeconds}초 후 재시도` : ''}`);
    return data;
  }
  return {
    async search(query, signal) {
      const valid = validateSatelliteSearch(query);
      const parameters = new URLSearchParams({ bbox: valid.bounds.join(','), start: valid.dateRange[0], end: valid.dateRange[1], cloud: String(valid.maxCloudCover) });
      return get(`/api/satellite/search?${parameters}`, signal);
    },
    async getScene(id, signal) {
      if (!validSceneId(id)) throw new Error('영상 ID 형식 오류');
      return (await get(`/api/satellite/scene?id=${encodeURIComponent(id)}`, signal)).scene;
    },
  };
}
