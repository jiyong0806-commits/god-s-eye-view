export function loadMapRuntime(doc = document) {
  if (globalThis.Cesium) return Promise.resolve();
  const reference = doc.querySelector('[data-gev-runtime-src]');
  if (!reference) return Promise.reject(new Error('지도 엔진 경로를 확인하지 못했습니다.'));
  return new Promise((resolve, reject) => {
    const script = doc.createElement('script'); script.src = reference.dataset.gevRuntimeSrc;
    const timeout = setTimeout(() => { script.remove(); reject(new Error('지도 엔진을 불러오지 못했습니다. 다시 연결하세요.')); }, 30000);
    script.onload = () => { clearTimeout(timeout); resolve(); };
    script.onerror = () => { clearTimeout(timeout); script.remove(); reject(new Error('지도 엔진 연결 실패')); };
    doc.head.append(script);
  });
}
