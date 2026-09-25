import { governorRequestRender, holdContinuousRender, releaseContinuousRender } from './renderGovernor.js';

const SCRIPT_URLS = [
  'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js',
];

const HANDS_ASSET_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/';

function distance(a, b) {
  const dx = (a?.x || 0) - (b?.x || 0);
  const dy = (a?.y || 0) - (b?.y || 0);
  const dz = (a?.z || 0) - (b?.z || 0);
  return Math.hypot(dx, dy, dz);
}

function loadScript(src) {
  const existing = document.querySelector(`script[src="${src}"]`);
  if (existing) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`손 추적 스크립트 로딩 실패: ${src}`));
    document.head.appendChild(script);
  });
}

function injectStyles() {
  if (document.getElementById('hand-tracking-styles')) return;
  const style = document.createElement('style');
  style.id = 'hand-tracking-styles';
  style.textContent = `
    #hand-tracking-panel {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 9200;
      width: 244px;
      color: #dffaff;
      font: 500 11px/1.35 "JetBrains Mono", monospace;
      letter-spacing: 0;
      text-transform: uppercase;
      background: rgba(5, 11, 20, 0.78);
      border: 1px solid rgba(0, 229, 255, 0.45);
      box-shadow: 0 0 24px rgba(0, 229, 255, 0.16), inset 0 0 18px rgba(0, 229, 255, 0.08);
      backdrop-filter: blur(10px);
      border-radius: 8px;
      overflow: hidden;
    }
    #hand-tracking-panel.is-collapsed {
      width: 126px;
    }
    #hand-tracking-panel header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 8px 10px;
      border-bottom: 1px solid rgba(0, 229, 255, 0.18);
    }
    #hand-tracking-panel.is-collapsed header {
      border-bottom: 0;
      padding: 7px;
    }
    #hand-tracking-panel.is-collapsed strong,
    #hand-tracking-panel.is-collapsed #hand-tracking-body {
      display: none;
    }
    #hand-tracking-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    #hand-tracking-toggle {
      border: 1px solid rgba(0, 229, 255, 0.55);
      background: rgba(0, 184, 212, 0.14);
      color: #dffaff;
      border-radius: 6px;
      min-height: 30px;
      padding: 0 9px;
      font: inherit;
      cursor: pointer;
    }
    #hand-tracking-collapse {
      width: 30px;
      min-width: 30px;
      height: 30px;
      border: 1px solid rgba(0, 229, 255, 0.38);
      background: rgba(0, 184, 212, 0.08);
      color: #dffaff;
      border-radius: 6px;
      font: inherit;
      cursor: pointer;
    }
    #hand-tracking-toggle[data-active="true"] {
      background: rgba(0, 229, 255, 0.9);
      color: #02121a;
    }
    #hand-tracking-canvas {
      display: block;
      width: 244px;
      height: 158px;
      background: rgba(0, 0, 0, 0.28);
    }
    #hand-tracking-status {
      min-height: 34px;
      padding: 8px 10px 10px;
      color: rgba(223, 250, 255, 0.82);
    }
    #hand-tracking-sensitivity-row {
      display: grid;
      grid-template-columns: auto 1fr 42px;
      gap: 8px;
      align-items: center;
      padding: 8px 10px 0;
      color: rgba(223, 250, 255, 0.76);
    }
    #hand-tracking-sensitivity {
      width: 100%;
      accent-color: #00e5ff;
    }
    #hand-tracking-cursor {
      position: fixed;
      left: 0;
      top: 0;
      z-index: 9199;
      width: 18px;
      height: 18px;
      margin: -9px 0 0 -9px;
      border: 1px solid rgba(0, 229, 255, 0.9);
      border-radius: 50%;
      background: rgba(0, 229, 255, 0.18);
      box-shadow: 0 0 18px rgba(0, 229, 255, 0.65);
      pointer-events: none;
      opacity: 0;
      transition: opacity 120ms ease;
    }
    #hand-tracking-panel video { display: none; }
  `;
  document.head.appendChild(style);
}

function createPanel() {
  injectStyles();
  const panel = document.createElement('aside');
  panel.id = 'hand-tracking-panel';
  panel.setAttribute('aria-label', '손 추적 컨트롤');
  panel.innerHTML = `
    <header>
      <strong>손 추적</strong>
      <div id="hand-tracking-actions">
        <button id="hand-tracking-collapse" type="button" aria-label="손 추적 패널 접기" title="손 추적 패널 접기">▾</button>
        <button id="hand-tracking-toggle" type="button">켜기</button>
      </div>
    </header>
    <div id="hand-tracking-body">
      <video id="hand-tracking-video" playsinline muted></video>
      <canvas id="hand-tracking-canvas" width="488" height="316"></canvas>
      <label id="hand-tracking-sensitivity-row" for="hand-tracking-sensitivity">
        <span>감도</span>
        <input id="hand-tracking-sensitivity" type="range" min="30" max="180" step="5" value="100" />
        <output id="hand-tracking-sensitivity-value" for="hand-tracking-sensitivity">100%</output>
      </label>
      <div id="hand-tracking-status" role="status" aria-live="polite">한 손 이동: 지구 회전 / 양손 거리: 확대·축소</div>
    </div>
  `;
  const cursor = document.createElement('div');
  cursor.id = 'hand-tracking-cursor';
  document.body.appendChild(cursor);
  document.body.appendChild(panel);
  return {
    panel,
    button: panel.querySelector('#hand-tracking-toggle'),
    collapseButton: panel.querySelector('#hand-tracking-collapse'),
    sensitivity: panel.querySelector('#hand-tracking-sensitivity'),
    sensitivityValue: panel.querySelector('#hand-tracking-sensitivity-value'),
    video: panel.querySelector('#hand-tracking-video'),
    canvas: panel.querySelector('#hand-tracking-canvas'),
    status: panel.querySelector('#hand-tracking-status'),
    cursor,
  };
}

function clickGlobeCanvas(viewer, x, y) {
  const canvas = viewer?.scene?.canvas;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const clientX = Math.max(rect.left, Math.min(rect.right, x));
  const clientY = Math.max(rect.top, Math.min(rect.bottom, y));
  for (const type of ['pointerdown', 'pointerup', 'click']) {
    canvas.dispatchEvent(new PointerEvent(type, {
      bubbles: true,
      clientX,
      clientY,
      pointerId: 77,
      pointerType: 'touch',
      isPrimary: true,
    }));
  }
}

export function initHandTrackingControls({ viewer } = {}) {
  if (!viewer || document.getElementById('hand-tracking-panel')) return null;

  const ui = createPanel();
  const ctx = ui.canvas.getContext('2d');
  let active = false;
  let hands = null;
  let camera = null;
  let lastPoint = null;
  let lastTwoHandDistance = null;
  let lastClickAt = 0;
  let sensitivity = 1;

  const setStatus = (message) => {
    ui.status.textContent = message;
  };

  const syncSensitivity = () => {
    sensitivity = Math.max(0.3, Math.min(1.8, Number(ui.sensitivity?.value || 100) / 100));
    if (ui.sensitivityValue) ui.sensitivityValue.textContent = `${Math.round(sensitivity * 100)}%`;
  };

  const stop = () => {
    active = false;
    ui.button.textContent = '켜기';
    ui.button.dataset.active = 'false';
    ui.cursor.style.opacity = '0';
    lastPoint = null;
    lastTwoHandDistance = null;
    try { camera?.stop?.(); } catch { /* MediaPipe camera may already be stopped. */ }
    const stream = ui.video.srcObject;
    if (stream && typeof stream.getTracks === 'function') {
      for (const track of stream.getTracks()) track.stop();
    }
    ui.video.srcObject = null;
    releaseContinuousRender('hand-tracking');
    setStatus('손 추적 꺼짐');
    ctx.clearRect(0, 0, ui.canvas.width, ui.canvas.height);
  };

  const applyHandResults = (results) => {
    if (!active) return;
    const width = ui.canvas.width;
    const height = ui.canvas.height;
    ctx.save();
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(2, 8, 14, 0.58)';
    ctx.fillRect(0, 0, width, height);

    const landmarks = results.multiHandLandmarks || [];
    const drawConnectors = window.drawConnectors;
    const drawLandmarks = window.drawLandmarks;
    const connections = window.HAND_CONNECTIONS;
    for (const hand of landmarks) {
      if (drawConnectors && connections) {
        drawConnectors(ctx, hand, connections, { color: '#00e5ff', lineWidth: 3 });
      }
      if (drawLandmarks) {
        drawLandmarks(ctx, hand, { color: '#ffffff', lineWidth: 1, radius: 3 });
      }
    }
    ctx.restore();

    if (!landmarks.length) {
      ui.cursor.style.opacity = '0';
      lastPoint = null;
      lastTwoHandDistance = null;
      setStatus('손을 카메라 앞에 보여주세요');
      return;
    }

    const primary = landmarks[0];
    const index = primary[8];
    const thumb = primary[4];
    const point = { x: index.x, y: index.y };
    const screenX = index.x * window.innerWidth;
    const screenY = index.y * window.innerHeight;
    ui.cursor.style.opacity = '1';
    ui.cursor.style.transform = `translate(${screenX}px, ${screenY}px)`;

    if (landmarks.length >= 2) {
      const leftTip = landmarks[0][8];
      const rightTip = landmarks[1][8];
      const handGap = distance(leftTip, rightTip);
      if (Number.isFinite(lastTwoHandDistance)) {
        const delta = handGap - lastTwoHandDistance;
        if (Math.abs(delta) > 0.006) {
          const heightM = Math.max(50, viewer.camera.positionCartographic?.height || 1200);
          const amount = Math.min(heightM * 0.16, Math.max(heightM * 0.012, heightM * Math.abs(delta) * 1.15 * sensitivity));
          if (delta > 0) viewer.camera.zoomIn(amount);
          else viewer.camera.zoomOut(amount);
          governorRequestRender('hand-zoom');
        }
      }
      lastTwoHandDistance = handGap;
      lastPoint = point;
      setStatus('양손 거리로 확대·축소 중');
      return;
    }

    lastTwoHandDistance = null;
    const pinching = distance(index, thumb) < 0.055;
    if (pinching) {
      const now = performance.now();
      if (now - lastClickAt > 650) {
        clickGlobeCanvas(viewer, screenX, screenY);
        lastClickAt = now;
      }
      setStatus('핀치: 지도 선택');
    } else if (lastPoint) {
      const dx = point.x - lastPoint.x;
      const dy = point.y - lastPoint.y;
      if (Math.hypot(dx, dy) > 0.002) {
        viewer.camera.rotateRight(-dx * 3.8 * sensitivity);
        viewer.camera.rotateUp(dy * 2.8 * sensitivity);
        governorRequestRender('hand-orbit');
      }
      setStatus('한 손 이동: 지구 회전');
    }
    lastPoint = point;
  };

  const start = async () => {
    if (active) return;
    ui.button.disabled = true;
    setStatus('손 추적 로딩 중...');
    try {
      for (const url of SCRIPT_URLS) await loadScript(url);
      hands = hands || new window.Hands({
        locateFile: (file) => `${HANDS_ASSET_ROOT}${file}`,
      });
      hands.setOptions({
        selfieMode: true,
        maxNumHands: 2,
        modelComplexity: 0,
        minDetectionConfidence: 0.65,
        minTrackingConfidence: 0.65,
      });
      hands.onResults(applyHandResults);
      camera = new window.Camera(ui.video, {
        width: 640,
        height: 480,
        onFrame: async () => {
          if (active) await hands.send({ image: ui.video });
        },
      });
      await camera.start();
      active = true;
      holdContinuousRender('hand-tracking');
      ui.button.textContent = '끄기';
      ui.button.dataset.active = 'true';
      setStatus('한 손 이동: 지구 회전 / 양손 거리: 확대·축소');
    } catch (error) {
      console.warn('[HandTracking]', error);
      setStatus(error?.message || '손 추적 시작 실패');
      stop();
    } finally {
      ui.button.disabled = false;
    }
  };

  ui.button.addEventListener('click', () => {
    if (active) stop();
    else start();
  });
  ui.collapseButton.addEventListener('click', () => {
    const collapsed = !ui.panel.classList.contains('is-collapsed');
    ui.panel.classList.toggle('is-collapsed', collapsed);
    ui.collapseButton.textContent = collapsed ? '▴' : '▾';
    ui.collapseButton.setAttribute('aria-label', collapsed ? '손 추적 패널 펼치기' : '손 추적 패널 접기');
    ui.collapseButton.title = collapsed ? '손 추적 패널 펼치기' : '손 추적 패널 접기';
  });
  ui.sensitivity.addEventListener('input', syncSensitivity);
  syncSensitivity();

  const api = {
    start,
    stop,
    isActive: () => active,
    setSensitivity: (value) => {
      ui.sensitivity.value = String(Math.round(Number(value) || 100));
      syncSensitivity();
    },
  };
  window.__godsEyeView = window.__godsEyeView || {};
  window.__godsEyeView.handTracking = api;
  return api;
}
