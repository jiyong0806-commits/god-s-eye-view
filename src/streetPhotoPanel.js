import * as Cesium from 'cesium';
import { governorRequestRender } from './renderGovernor.js';

const STYLE_ID = 'gev-street-photo-style';

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .street-photo-open {
      position: fixed;
      top: 76px;
      right: 18px;
      z-index: 50;
      border: 1px solid rgba(0, 229, 255, 0.45);
      border-radius: 8px;
      background: rgba(6, 13, 24, 0.76);
      color: #d9fbff;
      font: 600 11px/1.1 "Inter", system-ui, sans-serif;
      letter-spacing: 0;
      padding: 9px 11px;
      cursor: pointer;
      backdrop-filter: blur(12px);
      box-shadow: 0 0 18px rgba(0, 229, 255, 0.12);
    }
    .street-photo-open:hover { background: rgba(0, 82, 104, 0.82); }
    .street-photo-panel {
      position: fixed;
      right: 18px;
      top: 116px;
      width: min(390px, calc(100vw - 36px));
      height: min(520px, calc(100vh - 148px));
      display: none;
      flex-direction: column;
      overflow: hidden;
      z-index: 55;
      border: 1px solid rgba(0, 229, 255, 0.42);
      border-radius: 8px;
      background: rgba(5, 9, 18, 0.92);
      box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45), inset 0 0 0 1px rgba(255,255,255,0.04);
      backdrop-filter: blur(16px);
    }
    .street-photo-panel.open { display: flex; }
    .street-photo-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 38px;
      padding: 0 10px 0 12px;
      border-bottom: 1px solid rgba(0, 229, 255, 0.16);
      color: #e7fdff;
      font: 700 12px/1 "Inter", system-ui, sans-serif;
    }
    .street-photo-header small {
      margin-left: 8px;
      color: rgba(197, 247, 255, 0.58);
      font-size: 10px;
      font-weight: 500;
    }
    .street-photo-header button {
      width: 28px;
      height: 28px;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 7px;
      background: rgba(255,255,255,0.04);
      color: #e7fdff;
      cursor: pointer;
    }
    .street-photo-actions {
      display: flex;
      gap: 8px;
      padding: 9px 10px;
      border-bottom: 1px solid rgba(0, 229, 255, 0.12);
    }
    .street-photo-actions button,
    .street-photo-actions a {
      flex: 1 1 0;
      text-align: center;
      border: 1px solid rgba(0, 229, 255, 0.3);
      border-radius: 7px;
      background: rgba(0, 164, 198, 0.16);
      color: #dffcff;
      text-decoration: none;
      font: 650 11px/1 "Inter", system-ui, sans-serif;
      padding: 8px 9px;
      cursor: pointer;
    }
    .street-photo-frame {
      flex: 1 1 auto;
      min-height: 0;
      border: 0;
      background: #02050a;
      display: grid;
      align-content: center;
      justify-items: center;
      gap: 16px;
      padding: 24px;
      color: #dffcff;
      text-align: center;
    }
    .street-photo-frame a { color: #67eaff; font-weight: 700; }
    .street-photo-note {
      padding: 8px 11px;
      color: rgba(207, 244, 255, 0.62);
      font: 500 10px/1.35 "Inter", system-ui, sans-serif;
      border-top: 1px solid rgba(0, 229, 255, 0.12);
    }
    @media (max-width: 720px) {
      .street-photo-open { top: 68px; right: 10px; }
      .street-photo-panel {
        right: 10px;
        top: 108px;
        width: calc(100vw - 20px);
        height: min(62vh, 560px);
      }
    }
  `;
  document.head.appendChild(style);
}

function cameraCenter(viewer) {
  const canvas = viewer.scene.canvas;
  const center = new Cesium.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2);
  const picked = viewer.camera.pickEllipsoid(center, Cesium.Ellipsoid.WGS84);
  const cartographic = picked
    ? Cesium.Cartographic.fromCartesian(picked)
    : viewer.camera.positionCartographic;
  return {
    lat: Cesium.Math.toDegrees(cartographic.latitude),
    lon: Cesium.Math.toDegrees(cartographic.longitude),
  };
}

function mapillaryUrl({ lat, lon }) {
  return `https://www.mapillary.com/app/?lat=${lat.toFixed(6)}&lng=${lon.toFixed(6)}&z=17`;
}

export function initStreetPhotoPanel({ viewer }) {
  if (!viewer || document.querySelector('.street-photo-open')) return null;
  installStyles();

  const openButton = document.createElement('button');
  openButton.type = 'button';
  openButton.className = 'street-photo-open';
  openButton.textContent = '거리 사진';
  openButton.title = '현재 화면 중심의 Mapillary 거리 사진을 엽니다';

  const panel = document.createElement('section');
  panel.className = 'street-photo-panel';
  panel.setAttribute('aria-label', '거리 사진 패널');
  panel.innerHTML = `
    <div class="street-photo-header">
      <div>거리 사진 <small>Mapillary</small></div>
      <button type="button" data-street-close aria-label="닫기">×</button>
    </div>
    <div class="street-photo-actions">
      <button type="button" data-street-refresh>현재 위치</button>
      <a data-street-link href="https://www.mapillary.com/app/" target="_blank" rel="noopener">새 창</a>
    </div>
    <div class="street-photo-frame"><p>사진 제공 사이트가 이 페이지 안의 재생을 차단합니다.<br>공개된 거리 사진이 있는 지역은 새 창에서 확인할 수 있습니다.</p><a data-street-photo-link target="_blank" rel="noopener noreferrer" href="https://www.mapillary.com/app/">Mapillary 거리 사진 열기 ↗</a></div>
    <div class="street-photo-note">무료 공개 거리 사진입니다. 실제 CCTV나 사설 카메라 해킹이 아니라 공개 이미지 위치를 여는 안전한 방식입니다.</div>
  `;

  document.body.appendChild(openButton);
  document.body.appendChild(panel);

  const photoLink = panel.querySelector('[data-street-photo-link]');
  const link = panel.querySelector('[data-street-link]');

  const open = () => {
    const url = mapillaryUrl(cameraCenter(viewer));
    photoLink.href = url;
    link.href = url;
    panel.classList.add('open');
    governorRequestRender('street-photo-panel');
  };
  const close = () => {
    panel.classList.remove('open');
    governorRequestRender('street-photo-panel');
  };

  openButton.addEventListener('click', open);
  panel.querySelector('[data-street-refresh]')?.addEventListener('click', open);
  panel.querySelector('[data-street-close]')?.addEventListener('click', close);

  return { open, close };
}

export default initStreetPhotoPanel;
