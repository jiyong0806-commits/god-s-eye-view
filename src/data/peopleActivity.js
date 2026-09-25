import * as Cesium from 'cesium';
import { CITY_POIS } from '../locations.js';
import { governorRequestRender, holdContinuousRender, releaseContinuousRender } from '../renderGovernor.js';

const MAX_POINTS = 160;
const POINTS_PER_POI = 4;
const ACTIVITY_RADIUS_M = 190;
const LABEL_SAMPLE_MAX = 80;

let _viewer = null;
let _points = null;
let _rows = [];
let _enabled = false;
let _removePreRender = null;
let _lastPulseMs = 0;

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededNoise(seed, salt) {
  const x = Math.sin((seed + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function offsetMeters(lat, lon, northM, eastM) {
  const dLat = northM / 111_320;
  const dLon = eastM / (111_320 * Math.max(0.2, Math.cos(Cesium.Math.toRadians(lat))));
  return { lat: lat + dLat, lon: lon + dLon };
}

function activityColor(kind, pulse = 0) {
  if (kind === 'vehicle') return Cesium.Color.fromCssColorString('#ff4f55').withAlpha(0.62 + pulse * 0.2);
  if (kind === 'crowd') return Cesium.Color.fromCssColorString('#16d7ff').withAlpha(0.58 + pulse * 0.18);
  if (kind === 'transit') return Cesium.Color.fromCssColorString('#ffd75a').withAlpha(0.54 + pulse * 0.2);
  return Cesium.Color.fromCssColorString('#7cff9b').withAlpha(0.5 + pulse * 0.2);
}

function makeActivityRows() {
  const rows = [];
  for (const [cityId, city] of Object.entries(CITY_POIS)) {
    const pois = Array.isArray(city?.pois) ? city.pois : [];
    for (let poiIndex = 0; poiIndex < pois.length; poiIndex += 1) {
      const poi = pois[poiIndex];
      if (!Number.isFinite(poi?.lat) || !Number.isFinite(poi?.lon)) continue;
      const seed = hashString(`${cityId}:${poi.name || poiIndex}`);
      for (let i = 0; i < POINTS_PER_POI; i += 1) {
        const angle = seededNoise(seed, i) * Math.PI * 2;
        const radius = Math.sqrt(seededNoise(seed, i + 19)) * ACTIVITY_RADIUS_M * (0.35 + seededNoise(seed, i + 41) * 0.75);
        const p = offsetMeters(poi.lat, poi.lon, Math.cos(angle) * radius, Math.sin(angle) * radius);
        const kindRoll = seededNoise(seed, i + 73);
        const kind = kindRoll > 0.82 ? 'vehicle' : kindRoll > 0.68 ? 'transit' : kindRoll > 0.38 ? 'crowd' : 'pedestrian';
        rows.push({
          id: `PER-${cityId}-${poiIndex}-${i}`,
          city: city.name || cityId,
          place: poi.name || city.name || cityId,
          lat: p.lat,
          lon: p.lon,
          kind,
          phase: seededNoise(seed, i + 101) * Math.PI * 2,
          size: 4.5 + seededNoise(seed, i + 131) * 3.5,
        });
      }
    }
  }
  return rows.slice(0, MAX_POINTS);
}

function ensureCollection(viewer) {
  if (_points) return _points;
  _points = new Cesium.PointPrimitiveCollection({ blendOption: Cesium.BlendOption.TRANSLUCENT });
  viewer.scene.primitives.add(_points);
  _points.show = false;
  return _points;
}

function renderRows(viewer) {
  const collection = ensureCollection(viewer);
  collection.removeAll();
  _rows = makeActivityRows();
  for (const row of _rows) {
    const point = collection.add({
      id: row.id,
      position: Cesium.Cartesian3.fromDegrees(row.lon, row.lat, 4),
      pixelSize: row.size,
      color: activityColor(row.kind, 0.25),
      outlineColor: Cesium.Color.BLACK.withAlpha(0.62),
      outlineWidth: 1,
      scaleByDistance: new Cesium.NearFarScalar(250, 1.35, 22000, 0.25),
      translucencyByDistance: new Cesium.NearFarScalar(250, 1, 28000, 0),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    });
    row.point = point;
    row.position = point.position;
  }
}

function animatePulse(scene, time) {
  if (!_enabled || !_points || !_rows.length) return;
  const now = performance.now();
  if (now - _lastPulseMs < 140) return;
  _lastPulseMs = now;
  const t = now / 650;
  for (const row of _rows) {
    const pulse = (Math.sin(t + row.phase) + 1) / 2;
    row.point.pixelSize = row.size + pulse * 2.4;
    row.point.color = activityColor(row.kind, pulse);
  }
  governorRequestRender('people-activity-pulse');
  void scene;
  void time;
}

const peopleActivityLayer = {
  id: 'people-activity',
  name: 'People Activity',
  icon: '👥',
  source: 'Estimated city activity',
  showInTogglePanel: true,

  init(viewer) {
    _viewer = viewer;
    ensureCollection(viewer);
  },

  async enable(viewer = _viewer) {
    if (!viewer) return;
    _viewer = viewer;
    renderRows(viewer);
    _enabled = true;
    _points.show = true;
    holdContinuousRender('people-activity');
    if (!_removePreRender) _removePreRender = viewer.scene.preRender.addEventListener(animatePulse);
    governorRequestRender('people-activity');
  },

  async disable() {
    _enabled = false;
    if (_points) _points.show = false;
    if (_removePreRender) {
      _removePreRender();
      _removePreRender = null;
    }
    releaseContinuousRender('people-activity');
    governorRequestRender('people-activity');
  },

  async update() {
    return undefined;
  },

  getDetectableObjects(options = {}) {
    if (!_enabled || !_rows.length) return [];
    const maxCount = Number.isFinite(options.maxCount)
      ? Math.max(1, Math.min(LABEL_SAMPLE_MAX, Math.floor(options.maxCount)))
      : LABEL_SAMPLE_MAX;
    const seed = Number.isFinite(options.seed) ? Math.floor(options.seed) : 0;
    const stride = Math.max(1, Math.ceil(_rows.length / maxCount));
    const start = seed % stride;
    const result = [];
    for (let i = start; i < _rows.length; i += stride) {
      const row = _rows[i];
      result.push({
        position: row.position,
        sourceId: row.id,
        id: row.id,
        type: row.kind === 'vehicle' ? 'VEH' : (row.kind === 'transit' ? 'FLOW' : 'PERSON'),
        tier: row.kind === 'vehicle' ? 'veh_slow' : (row.kind === 'crowd' ? 'person_crowd' : 'person'),
        label: row.place,
      });
      if (result.length >= maxCount) break;
    }
    return result;
  },

  destroy() {
    this.disable();
    if (_points && _viewer?.scene?.primitives) {
      try { _viewer.scene.primitives.remove(_points); } catch { /* already removed */ }
    }
    _points = null;
    _rows = [];
    _viewer = null;
  },

  getStats() {
    return {
      count: _enabled ? _rows.length : 0,
      lastUpdate: _enabled ? new Date() : null,
      source: '오프라인 도시 사람·차량 활동 추정',
      mode: 'estimate',
      fallback: true,
    };
  },
};

export default peopleActivityLayer;
