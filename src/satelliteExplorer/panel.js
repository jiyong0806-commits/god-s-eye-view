import * as Cesium from 'cesium';
import { createSatelliteProvider } from './provider.js';
import { parseSpatialIntent } from '../spatial/intent.js';
import { previewPermission } from './model.js';
import { sourceCard } from '../spatial/sourceCard.js';

const node = (tag, value, className) => { const el = document.createElement(tag); if (value) el.textContent = value; if (className) el.className = className; return el; };
export function satellitePanel({ container, viewer, selectedLocation, onResolveLocation, initialQuery = '' }) {
  const provider = createSatelliteProvider();
  const lifetime = new AbortController(); let searchController, previewController, generation = 0, previewUrl, footprint;
  const form = node('form', '', 'satellite-search');
  const location = node('input'); location.type = 'search'; location.placeholder = selectedLocation?.name || '현재 지도 중심';
  location.value = initialQuery; location.maxLength = 160;
  function field(title, input) { const label = node('label', title); label.append(input); form.append(label); return input; }
  field('지역', location);
  const end = field('촬영 종료일', node('input')); end.type = 'date'; end.value = end.max = new Date().toISOString().slice(0, 10);
  const start = field('촬영 시작일', node('input')); start.type = 'date'; start.value = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10); start.max = end.max;
  const cloud = node('input'); cloud.type = 'range'; cloud.min = '0'; cloud.max = '100'; cloud.value = '30';
  const cloudLabel = node('label', '최대 구름 비율'); const cloudValue = node('output', '30%'); cloudLabel.append(cloud, cloudValue); form.append(cloudLabel);
  cloud.oninput = () => { cloudValue.textContent = `${cloud.value}%`; };
  const search = node('button', '위성영상 검색'); search.type = 'submit'; form.append(search);
  const status = node('p', '', 'wc-muted'); status.setAttribute('role', 'status');
  const results = node('div', '', 'satellite-results'); const preview = node('section', '', 'satellite-preview');
  container.append(node('h3', 'Satellite Explorer'), form, status, preview, results);
  function clearPreview() {
    previewController?.abort(); if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = null; preview.replaceChildren();
    if (footprint) viewer.entities.remove(footprint); footprint = null; viewer.scene.requestRender();
  }
  async function select(scene) {
    clearPreview(); previewController = new AbortController();
    const signal = AbortSignal.any([lifetime.signal, previewController.signal, AbortSignal.timeout(15000)]);
    const message = node('p', '선택한 촬영 영상 확인 중…'); preview.append(message);
    try {
      const checked = await provider.getScene(scene.id, signal); if (signal.aborted) return;
      const permission = previewPermission(checked); if (!permission.allowed) throw new Error(permission.reason);
      const response = await fetch(`/api/satellite/preview?id=${encodeURIComponent(checked.id)}`, { signal });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || `미리보기 HTTP ${response.status}`); }
      const blob = await response.blob(); if (signal.aborted) return;
      previewUrl = URL.createObjectURL(blob); const image = node('img'); image.src = previewUrl; image.alt = `${checked.acquiredAt} Sentinel-2 촬영 미리보기`;
      image.onerror = () => { message.textContent = '위성 미리보기 이미지 로드 실패'; };
      message.textContent = `촬영 ${new Date(checked.acquiredAt).toLocaleString('ko-KR')} · 저해상도 미리보기`;
      preview.append(image, node('p', checked.attribution, 'wc-muted'), node('p', '정밀 COG 지도 오버레이 미지원', 'wc-muted'));
      footprint = viewer.entities.add({ id: 'satellite-explorer-selection', rectangle: {
        coordinates: Cesium.Rectangle.fromDegrees(...checked.bounds), material: Cesium.Color.CYAN.withAlpha(.06),
        outline: true, outlineColor: Cesium.Color.CYAN } });
      viewer.camera.flyTo({ destination: Cesium.Rectangle.fromDegrees(...checked.bounds), duration: .6 }); viewer.scene.requestRender();
    } catch (error) { if (!lifetime.signal.aborted && !previewController.signal.aborted) message.textContent = error.message; }
  }
  function card(scene) {
    const item = node('section', '', 'satellite-scene');
    item.append(node('h3', scene.id), node('p', `촬영: ${new Date(scene.acquiredAt).toLocaleString('ko-KR')}`),
      node('p', `구름: ${scene.cloudCover === null ? '자료 없음' : `${scene.cloudCover.toFixed(2)}%`}`),
      node('p', `제공 에셋: ${scene.assets.length} · ${scene.assets.find(asset => asset.id === 'visual')?.resolutionM || '미확인'}m 원본`), sourceCard(scene));
    const button = node('button', '영상 미리보기 · 촬영 범위'); button.type = 'button';
    const permission = previewPermission(scene); button.disabled = !permission.allowed; button.title = permission.reason;
    button.onclick = () => select(scene); item.append(button); return item;
  }
  form.onsubmit = async event => {
    event.preventDefault(); searchController?.abort(); clearPreview(); searchController = new AbortController();
    const current = ++generation; const signal = AbortSignal.any([lifetime.signal, searchController.signal]);
    search.disabled = true; results.replaceChildren(); status.textContent = '촬영 목록 확인 중…';
    try {
      let position = selectedLocation;
      if (location.value.trim()) {
        const intent = parseSpatialIntent(location.value.trim());
        if (intent && intent.concept !== 'satellite-imagery') throw new Error('이 탐색기에서는 위성사진을 선택하세요.');
        position = await onResolveLocation(intent?.location || location.value.trim());
        if (!position || signal.aborted) { if (current === generation && !signal.aborted) status.textContent = '지역 선택이 취소됐습니다.'; return; }
      }
      if (!position) { const p = viewer.camera.positionCartographic; position = { lat: Cesium.Math.toDegrees(p.latitude), lon: Cesium.Math.toDegrees(p.longitude) }; }
      const bounds = [Math.max(-180, position.lon - .2), Math.max(-90, position.lat - .2), Math.min(180, position.lon + .2), Math.min(90, position.lat + .2)];
      const data = await provider.search({ bounds, dateRange: [start.value, end.value], maxCloudCover: Number(cloud.value) }, signal);
      if (current !== generation || signal.aborted) return;
      status.textContent = data.scenes.length ? `${position.name || '지도 중심'} · ${data.scenes.length}개 촬영 기록${data.hasMore ? ' · 최신 12개까지 표시' : ''}` : '이 기간·지역·구름 조건의 촬영 기록이 없습니다.';
      results.replaceChildren(...data.scenes.map(card));
    } catch (error) { if (current === generation && !signal.aborted) status.textContent = error.message; }
    finally { if (current === generation) search.disabled = false; }
  };
  return { destroy() { lifetime.abort(); searchController?.abort(); generation++; clearPreview(); } };
}
