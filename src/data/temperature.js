import * as Cesium from 'cesium';
import { governorRequestRender, holdContinuousRender, releaseContinuousRender } from '../renderGovernor.js';

const CITY_TEMPERATURES = Object.freeze([
  { name: '서울', lat: 37.5665, lon: 126.978, tempC: 23, radiusM: 42000 },
  { name: '인천', lat: 37.4563, lon: 126.7052, tempC: 22, radiusM: 32000 },
  { name: '수원', lat: 37.2636, lon: 127.0286, tempC: 24, radiusM: 28000 },
  { name: '대전', lat: 36.3504, lon: 127.3845, tempC: 25, radiusM: 30000 },
  { name: '대구', lat: 35.8714, lon: 128.6014, tempC: 27, radiusM: 34000 },
  { name: '부산', lat: 35.1796, lon: 129.0756, tempC: 24, radiusM: 36000 },
  { name: '광주', lat: 35.1595, lon: 126.8526, tempC: 26, radiusM: 30000 },
  { name: '제주', lat: 33.4996, lon: 126.5312, tempC: 25, radiusM: 30000 },
  { name: '도쿄', lat: 35.6762, lon: 139.6503, tempC: 25, radiusM: 46000 },
  { name: '타이베이', lat: 25.033, lon: 121.5654, tempC: 29, radiusM: 38000 },
  { name: '싱가포르', lat: 1.3521, lon: 103.8198, tempC: 31, radiusM: 36000 },
]);

function colorForTemp(tempC, alpha = 0.34) {
  if (tempC >= 29) return Cesium.Color.fromCssColorString('#ff4d2e').withAlpha(alpha);
  if (tempC >= 26) return Cesium.Color.fromCssColorString('#ffb000').withAlpha(alpha);
  if (tempC >= 22) return Cesium.Color.fromCssColorString('#36f0a4').withAlpha(alpha);
  return Cesium.Color.fromCssColorString('#21cfff').withAlpha(alpha);
}

const temperatureLayer = {
  id: 'temperature',
  name: '온도',
  icon: '🌡',
  source: '가벼운 도시 온도 시각화',
  updateInterval: 180000,
  showInTogglePanel: true,
  _viewer: null,
  _entities: [],
  _labels: [],
  _enabled: false,
  _pulse: null,
  _stats: { count: 0, source: '도시 온도 추정', status: 'idle' },

  async init(viewer) {
    this._viewer = viewer;
  },

  async enable() {
    if (!this._viewer || this._enabled) return;
    this._enabled = true;
    this._entities = CITY_TEMPERATURES.map((city) => this._viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(city.lon, city.lat, 120),
      ellipse: {
        semiMajorAxis: city.radiusM,
        semiMinorAxis: city.radiusM,
        height: 20,
        material: colorForTemp(city.tempC),
        outline: true,
        outlineColor: colorForTemp(city.tempC, 0.9),
        classificationType: Cesium.ClassificationType.BOTH,
      },
      label: {
        text: `${city.name} ${city.tempC}°C`,
        font: '600 12px Inter, system-ui, sans-serif',
        fillColor: Cesium.Color.WHITE.withAlpha(0.9),
        outlineColor: Cesium.Color.BLACK.withAlpha(0.75),
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -18),
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 1800000),
      },
    }));
    this._labels = CITY_TEMPERATURES;
    this._stats = {
      count: CITY_TEMPERATURES.length,
      source: '키 없는 경량 온도 오버레이',
      status: 'nominal',
      lastUpdate: Date.now(),
    };
    holdContinuousRender('temperature-layer');
    this._pulse = () => {
      const pulse = 0.28 + Math.sin(Date.now() * 0.0022) * 0.055;
      for (let i = 0; i < this._entities.length; i += 1) {
        const city = CITY_TEMPERATURES[i];
        this._entities[i].ellipse.material = colorForTemp(city.tempC, pulse);
      }
      governorRequestRender('temperature-layer');
    };
    this._viewer.scene.preRender.addEventListener(this._pulse);
    governorRequestRender('temperature-layer');
  },

  async disable() {
    if (!this._viewer) return;
    if (this._pulse) this._viewer.scene.preRender.removeEventListener(this._pulse);
    this._pulse = null;
    for (const entity of this._entities) this._viewer.entities.remove(entity);
    this._entities = [];
    this._enabled = false;
    releaseContinuousRender('temperature-layer');
    this._stats = { count: 0, source: '키 없는 경량 온도 오버레이', status: 'idle' };
    governorRequestRender('temperature-layer');
  },

  async update() {
    this._stats.lastUpdate = Date.now();
  },

  getStats() {
    return { ...this._stats };
  },

  getDetectableObjects() {
    if (!this._enabled) return [];
    return CITY_TEMPERATURES.map((city, index) => ({
      id: `TEMP-${index + 1}`,
      type: 'TEMP',
      label: `${city.name} ${city.tempC}°C`,
      tier: city.tempC >= 29 ? 'thermal_hot' : 'thermal_warm',
      position: Cesium.Cartesian3.fromDegrees(city.lon, city.lat, 900),
      confidence: 0.68,
    }));
  },

  destroy() {
    void this.disable();
    this._viewer = null;
  },
};

export default temperatureLayer;
