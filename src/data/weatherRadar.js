import * as Cesium from 'cesium';
import { governorRequestRender } from '../renderGovernor.js';

let viewer, layer, enabled = false, loading = false, error = null, updatedAt = null, controller;
export function validatedRadarFrame(data) {
  if (data?.host !== 'https://tilecache.rainviewer.com') return null;
  const frames = data.radar?.past;
  if (!Array.isArray(frames)) return null;
  const frame = frames.at(-1);
  if (typeof frame?.time !== 'number' || !/^\/v2\/radar\/\d+$/.test(frame.path)
    || Date.now() / 1000 - frame.time > 3600 || frame.time > Date.now() / 1000 + 60) return null;
  return frame;
}
const radar = {
  id: 'weather-radar', name: '날씨 레이더', icon: '◎', source: 'RainViewer · 강수 레이더', updateInterval: 300000,
  init(v) { viewer = v; },
  async enable(v = viewer) { viewer = v; enabled = true; await this.update(); if (error) { enabled = false; return false; } return true; },
  async update() {
    if (!enabled || loading) return; loading = true; error = null; controller = new AbortController();
    try {
      const r = await fetch('/api/rainviewer/metadata', { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) }); const data = await r.json();
      if (!r.ok) throw new Error(data.error || `RainViewer HTTP ${r.status}`); const frame = validatedRadarFrame(data);
      if (!frame) throw new Error('레이더 최신 시각 또는 타일 공급원 검증 실패');
      if (!enabled) return;
      const next = viewer.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
        url: `${data.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`, maximumLevel: 7, credit: 'RainViewer',
      })); next.alpha = .6;
      if (layer) viewer.imageryLayers.remove(layer, true); layer = next; updatedAt = frame.time * 1000;
      governorRequestRender('weather-radar');
    } catch (e) { if (enabled) error = e.message; }
    finally { loading = false; }
  },
  disable() { enabled = false; controller?.abort(); if (layer) viewer?.imageryLayers.remove(layer, true); layer = null; governorRequestRender('weather-radar'); },
  destroy() { this.disable(); viewer = null; },
  getStats() { return { count: layer ? 1 : 0, lastUpdate: updatedAt, loading, error,
    status: error ? 'restricted' : layer ? 'live' : 'idle', source: 'RainViewer', coverage: '레이더 관측 지역만 · 강수량, 사람·차량 위치 아님' }; },
};
export default radar;
