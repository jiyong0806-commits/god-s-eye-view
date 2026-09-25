import {
  LAYER_COLORS,
  LAYER_ICONS,
  SAFE_DATA_SOURCES,
  EXCLUDED_SOURCES,
  safetyColor,
} from './commercialSafeDataRegistry.js';

/**
 * Commercial-safe open-data layer suite for CesiumJS.
 *
 * This class intentionally avoids bundled proprietary data. Every network URL is
 * configurable so production deployments can route key-required APIs through a
 * server proxy and add attribution/rate limiting there.
 */
export class OpenDataLayerSuite {
  constructor({
    Cesium,
    viewer,
    fetchJson = (url, options) => fetch(url, options).then((response) => {
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return response.json();
    }),
    now = () => Date.now(),
    endpoints = {},
  }) {
    if (!Cesium || !viewer) throw new Error('OpenDataLayerSuite requires { Cesium, viewer }');
    this.Cesium = Cesium;
    this.viewer = viewer;
    this.fetchJson = fetchJson;
    this.now = now;
    this.endpoints = {
      rainviewer: 'https://api.rainviewer.com/public/weather-maps.json',
      naturalEarthBorders: '/data/ne_10m_admin_0_countries.geojson',
      overpass: 'https://overpass-api.de/api/interpreter',
      openaqLatest: 'https://api.openaq.org/v3/parameters/2/latest',
      usgsEarthquakes: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',
      firms: '/api/firms',
      acled: '/api/acled/events',
      frontlines: '/data/frontlines.geojson',
      ...endpoints,
    };
    this.layers = new Map();
    this.timers = new Set();
    this.safeSources = SAFE_DATA_SOURCES;
    this.excludedSources = EXCLUDED_SOURCES;
    this.colors = LAYER_COLORS;
    this.icons = LAYER_ICONS;
  }

  async toggle(layerId, enabled, options = {}) {
    const next = typeof enabled === 'boolean' ? enabled : !this.layers.get(layerId)?.enabled;
    if (!next) return this.disable(layerId);
    const method = `enable${layerId[0].toUpperCase()}${layerId.slice(1)}`;
    if (typeof this[method] !== 'function') throw new Error(`Unknown layer: ${layerId}`);
    return this[method](options);
  }

  disable(layerId) {
    const layer = this.layers.get(layerId);
    if (!layer) return;
    layer.enabled = false;
    for (const item of layer.items || []) this._remove(item);
    for (const timer of layer.timers || []) clearInterval(timer);
    this.layers.delete(layerId);
    this.viewer.scene.requestRender?.();
  }

  disableAll() {
    for (const id of [...this.layers.keys()]) this.disable(id);
  }

  async enableWeatherRadar({ opacity = 0.48, frameMs = 1500, color = 2 } = {}) {
    const id = 'weatherRadar';
    this.disable(id);
    const layer = this._layer(id);
    try {
      const meta = await this.fetchJson(this.endpoints.rainviewer);
      const frames = meta?.radar?.past || [];
      let index = 0;
      const show = () => {
        for (const item of layer.items) this.viewer.imageryLayers.remove(item, true);
        layer.items = [];
        const frame = frames[index % Math.max(frames.length, 1)];
        if (!frame?.path || !meta?.host) return;
        const provider = new this.Cesium.UrlTemplateImageryProvider({
          url: `${meta.host}${frame.path}/512/{z}/{x}/{y}/${color}/1_1.png`,
          maximumLevel: 7,
          credit: 'RainViewer weather radar',
        });
        const imagery = this.viewer.imageryLayers.addImageryProvider(provider);
        imagery.alpha = opacity;
        layer.items.push(imagery);
        index += 1;
        this.viewer.scene.requestRender?.();
      };
      show();
      layer.timers.push(setInterval(show, frameMs));
    } catch (error) {
      this._fallbackPoint(layer, 0, 0, 'Weather radar unavailable');
      console.warn('[OpenDataLayerSuite] weather radar failed:', error);
    }
  }

  enableInternetSpeed({ points = [] } = {}) {
    const id = 'internetSpeed';
    this.disable(id);
    const layer = this._layer(id);
    const fallback = points.length ? points : [
      { lat: 37.5665, lon: 126.9780, mbps: 120, label: 'Seoul sample' },
      { lat: 40.7128, lon: -74.0060, mbps: 95, label: 'New York sample' },
    ];
    for (const point of fallback) {
      const height = Math.max(20000, Number(point.mbps || 1) * 800);
      layer.items.push(this.viewer.entities.add({
        name: point.label || `M-Lab ${point.mbps || '--'} Mbps`,
        position: this.Cesium.Cartesian3.fromDegrees(point.lon, point.lat, height / 2),
        cylinder: {
          length: height,
          topRadius: 8000,
          bottomRadius: 8000,
          material: this.Cesium.Color.CYAN.withAlpha(0.36),
          outline: true,
          outlineColor: this.Cesium.Color.CYAN.withAlpha(0.82),
        },
        label: this._nearLabel(`${Math.round(point.mbps || 0)} Mbps`),
      }));
    }
  }

  async enableTrainTracker({ feedUrl, pollMs = 15000 } = {}) {
    const id = 'trainTracker';
    this.disable(id);
    const layer = this._layer(id);
    const samplesById = new Map();
    const update = async () => {
      try {
        const data = feedUrl ? await this.fetchJson(feedUrl) : { entity: [] };
        for (const vehicle of this._gtfsVehicles(data)) {
          const key = vehicle.id;
          const time = this.Cesium.JulianDate.now();
          const position = this.Cesium.Cartesian3.fromDegrees(vehicle.lon, vehicle.lat, 35);
          let record = samplesById.get(key);
          if (!record) {
            const property = new this.Cesium.SampledPositionProperty();
            property.setInterpolationOptions({
              interpolationDegree: 1,
              interpolationAlgorithm: this.Cesium.LinearApproximation,
            });
            const entity = this.viewer.entities.add({
              name: vehicle.label || 'Train',
              position: property,
              billboard: this._svgBillboard(this.icons.train, this.colors.train),
              path: { material: this.Cesium.Color.fromCssColorString(this.colors.train).withAlpha(0.45), width: 2, leadTime: 0, trailTime: 90 },
            });
            record = { property, entity };
            samplesById.set(key, record);
            layer.items.push(entity);
          }
          record.property.addSample(time, position);
        }
      } catch (error) {
        this._fallbackPoint(layer, 126.978, 37.5665, 'Train feed unavailable');
        console.warn('[OpenDataLayerSuite] train tracker failed:', error);
      }
    };
    await update();
    layer.timers.push(setInterval(update, pollMs));
  }

  async enableCountryBorders({ labelHeight = 2_500_000 } = {}) {
    const id = 'countryBorders';
    this.disable(id);
    const layer = this._layer(id);
    try {
      const data = await this.fetchJson(this.endpoints.naturalEarthBorders);
      const source = await this.Cesium.GeoJsonDataSource.load(data, { clampToGround: true });
      await this.viewer.dataSources.add(source);
      layer.items.push(source);
      for (const entity of source.entities.values) {
        if (entity.polyline) {
          entity.polyline.width = 2;
          entity.polyline.material = new this.Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.22,
            color: this.Cesium.Color.CYAN.withAlpha(0.9),
          });
          entity.polyline.clampToGround = true;
        }
        const name = entity.properties?.ADMIN?.getValue?.() || entity.properties?.name?.getValue?.();
        if (name && entity.position) {
          entity.label = this._nearLabel(name, labelHeight);
        }
      }
    } catch (error) {
      this._fallbackPoint(layer, 0, 0, 'Borders unavailable');
      console.warn('[OpenDataLayerSuite] borders failed:', error);
    }
  }

  async enableOsintLayers({ bbox = this._cameraBbox(), limit = 320 } = {}) {
    const id = 'osintLayers';
    this.disable(id);
    const layer = this._layer(id);
    try {
      const query = `
        [out:json][timeout:25];
        (
          node["man_made"="surveillance"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
          node["highway"="speed_camera"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
          node["amenity"="place_of_worship"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
          node["amenity"="parking"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
          node["amenity"="hospital"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
          node["emergency"="assembly_point"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
          node["railway"~"station|halt|subway_entrance"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
          node["aeroway"~"aerodrome|heliport"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
          node["natural"~"peak|bay|strait"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
          node["historic"~"ruins|archaeological_site|memorial|castle"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
        );
        out center ${limit};
      `;
      const url = `${this.endpoints.overpass}?data=${encodeURIComponent(query)}`;
      const data = await this.fetchJson(url);
      for (const element of (data.elements || []).slice(0, limit)) {
        const type = this._osmElementType(element.tags || {});
        layer.items.push(this.viewer.entities.add({
          name: element.tags?.name || type,
          position: this.Cesium.Cartesian3.fromDegrees(element.lon || element.center?.lon, element.lat || element.center?.lat, 18),
          billboard: this._svgBillboard(this.icons[type] || 'point', this.colors[type] || this.colors.camera),
          label: this._nearLabel(this._typeLabel(type), 9000),
          properties: {
            safeSource: 'osm',
            sourceLicense: SAFE_DATA_SOURCES.osm.license,
          },
        }));
      }
      this._enableEntityClustering(layer);
    } catch (error) {
      this._fallbackPoint(layer, bbox.west, bbox.south, 'OSINT unavailable');
      console.warn('[OpenDataLayerSuite] OSINT failed:', error);
    }
  }

  async enableAqiAirQuality({ minimum = 35, limit = 80 } = {}) {
    const id = 'aqiAirQuality';
    this.disable(id);
    const layer = this._layer(id);
    try {
      const data = await this.fetchJson(this.endpoints.openaqLatest);
      const rows = (data.results || []).filter((row) => Number(row.value) >= minimum).slice(0, limit);
      for (const row of rows) {
        const lat = row.coordinates?.latitude;
        const lon = row.coordinates?.longitude;
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        layer.items.push(this._smogParticleSystem(lon, lat, Math.min(1, Number(row.value) / 120)));
      }
    } catch (error) {
      this._fallbackPoint(layer, 126.978, 37.5665, 'AQI unavailable');
      console.warn('[OpenDataLayerSuite] AQI failed:', error);
    }
  }

  enableSecondaryDisasterAi({ events = [], radiusMeters = 9000 } = {}) {
    const id = 'secondaryDisasterAi';
    this.disable(id);
    const layer = this._layer(id);
    for (const event of events) {
      const risk = Math.min(1, Math.max(0.2, Number(event.slopeRisk || event.magnitude || 0.45) / 7));
      const positions = this._circleDegrees(event.lon, event.lat, radiusMeters * (0.6 + risk));
      layer.items.push(this.viewer.entities.add({
        name: event.label || 'Secondary disaster risk',
        polygon: {
          hierarchy: this.Cesium.Cartesian3.fromDegreesArray(positions.flat()),
          material: new this.Cesium.ColorMaterialProperty(
            new this.Cesium.CallbackProperty(() => {
              const alpha = 0.18 + Math.sin(this.now() / 260) * 0.08;
              return this.Cesium.Color.fromCssColorString(safetyColor('warning')).withAlpha(alpha);
            }, false),
          ),
          outline: true,
          outlineColor: this.Cesium.Color.fromCssColorString(safetyColor('warning')),
          height: 20,
        },
      }));
    }
  }

  async enableDisasterLiveTracker({ pollMs = 300000 } = {}) {
    const id = 'disasterLiveTracker';
    this.disable(id);
    const layer = this._layer(id);
    const update = async () => {
      for (const item of layer.items) this._remove(item);
      layer.items = [];
      await Promise.allSettled([this._loadEarthquakes(layer), this._loadFires(layer)]);
      this.viewer.scene.requestRender?.();
    };
    await update();
    layer.timers.push(setInterval(update, pollMs));
  }

  async enableWarMap({ timelineValue = 0 } = {}) {
    const id = 'warMap';
    this.disable(id);
    const layer = this._layer(id);
    try {
      const [events, frontlines] = await Promise.allSettled([
        this.fetchJson(this.endpoints.acled),
        this.fetchJson(this.endpoints.frontlines),
      ]);
      for (const event of (events.value?.events || events.value?.data || []).slice(0, 120)) {
        if (!Number.isFinite(event.latitude) || !Number.isFinite(event.longitude)) continue;
        layer.items.push(this.viewer.entities.add({
          name: event.headline || event.event_type || 'Conflict event',
          position: this.Cesium.Cartesian3.fromDegrees(event.longitude, event.latitude, 120),
          billboard: this._svgBillboard(this.icons.conflict, safetyColor('bad')),
          description: this._escapeHtml(event.headline || event.notes || 'Public conflict event'),
        }));
      }
      if (frontlines.value?.features) {
        const source = await this.Cesium.GeoJsonDataSource.load(frontlines.value, { clampToGround: true });
        await this.viewer.dataSources.add(source);
        layer.items.push(source);
        for (const entity of source.entities.values) {
          const side = entity.properties?.side?.getValue?.();
          const color = side === 'blue' ? this.Cesium.Color.BLUE : this.Cesium.Color.RED;
          if (entity.polygon) entity.polygon.material = color.withAlpha(0.3);
          if (entity.polyline) entity.polyline.material = color.withAlpha(0.65);
          entity.show = this._timelineVisible(entity, timelineValue);
        }
      }
    } catch (error) {
      this._fallbackPoint(layer, 30.5234, 50.4501, 'War map unavailable');
      console.warn('[OpenDataLayerSuite] war map failed:', error);
    }
  }

  setWarTimeline(value = 0) {
    const layer = this.layers.get('warMap');
    if (!layer) return;
    for (const item of layer.items || []) {
      if (!item.entities) continue;
      for (const entity of item.entities.values) entity.show = this._timelineVisible(entity, value);
    }
    this.viewer.scene.requestRender?.();
  }

  _layer(id) {
    const layer = { id, enabled: true, items: [], timers: [] };
    this.layers.set(id, layer);
    return layer;
  }

  _remove(item) {
    if (!item) return;
    if (this.viewer.entities.contains?.(item)) this.viewer.entities.remove(item);
    else if (this.viewer.dataSources.contains?.(item)) this.viewer.dataSources.remove(item, true);
    else if (this.viewer.imageryLayers.contains?.(item)) this.viewer.imageryLayers.remove(item, true);
    else if (this.viewer.scene.primitives.contains?.(item)) this.viewer.scene.primitives.remove(item);
  }

  _nearLabel(text, distance = 250000) {
    return {
      text,
      font: '12px sans-serif',
      fillColor: this.Cesium.Color.CYAN,
      outlineColor: this.Cesium.Color.BLACK,
      outlineWidth: 2,
      style: this.Cesium.LabelStyle.FILL_AND_OUTLINE,
      pixelOffset: new this.Cesium.Cartesian2(0, -22),
      distanceDisplayCondition: new this.Cesium.DistanceDisplayCondition(0, distance),
    };
  }

  _osmElementType(tags = {}) {
    if (tags.man_made === 'surveillance') return 'camera';
    if (tags.highway === 'speed_camera') return 'speedCamera';
    if (tags.amenity === 'place_of_worship') return 'worship';
    if (tags.amenity === 'parking') return 'parking';
    if (tags.amenity === 'hospital') return 'hospital';
    if (tags.emergency === 'assembly_point') return 'shelter';
    if (['station', 'halt', 'subway_entrance'].includes(tags.railway)) return 'train';
    if (tags.aeroway === 'heliport') return 'helicopter';
    if (tags.aeroway === 'aerodrome') return 'airplane';
    if (['bay', 'strait'].includes(tags.natural)) return 'ship';
    if (tags.natural === 'peak') return 'terrain';
    if (['ruins', 'archaeological_site', 'memorial', 'castle'].includes(tags.historic)) return 'historic';
    return 'point';
  }

  _typeLabel(type) {
    return ({
      camera: 'CCTV',
      speedCamera: '속도 카메라',
      worship: '종교 시설',
      parking: '주차장',
      hospital: '병원',
      shelter: '대피소',
      train: '철도/지하철',
      helicopter: '헬기장',
      airplane: '공항',
      ship: '해역/해협',
      terrain: '산/지형',
      historic: '역사/폐허',
      car: '차량',
      fire: '화재',
      conflict: '분쟁',
      point: '공개 위치',
    })[type] || type;
  }

  _svgBillboard(kind, color) {
    const paths = {
      crosshair: '<path d="M32 8v48M8 32h48M32 18a14 14 0 1 0 0 28a14 14 0 0 0 0-28Z"/>',
      camera: '<path d="M14 25h23l5-6h8v26H14Z"/><path d="M24 25v-7h12"/><circle cx="35" cy="35" r="7"/>',
      speedCamera: '<path d="M17 22h22l7 8v16H17Z"/><path d="M46 31l8-5v18l-8-5"/><path d="M24 38h10"/><path d="M31 31l-5 9h10Z"/>',
      worship: '<path d="M32 11v42M21 22h22"/><path d="M18 53h28"/><path d="M24 34l8-8l8 8v19H24Z"/>',
      parking: '<path d="M22 51V14h17a10 10 0 0 1 0 20H22"/><path d="M22 34h17"/>',
      hospital: '<path d="M18 18h28v28H18Z"/><path d="M32 23v18M23 32h18"/>',
      shelter: '<path d="M12 34l20-18l20 18"/><path d="M18 31v19h28V31"/><path d="M28 50V38h8v12"/>',
      train: '<path d="M19 15h26v25a8 8 0 0 1-8 8H27a8 8 0 0 1-8-8Z"/><path d="M24 22h16M24 31h16M25 55l6-7M39 55l-6-7"/>',
      airplane: '<path d="M32 8l5 22l17 8l-14 4l-3 14l-5-11l-5 11l-3-14l-14-4l17-8Z"/>',
      helicopter: '<path d="M14 19h36M30 19v11"/><path d="M20 33h24l8 8H38l-6 7l-6-7H12Z"/><path d="M20 52h24"/>',
      ship: '<path d="M14 39h36l-7 12H21Z"/><path d="M24 39V22h16v17"/><path d="M28 22l4-8l4 8"/><path d="M16 54c5-3 10-3 16 0c6-3 11-3 16 0"/>',
      terrain: '<path d="M10 50l14-24l9 13l7-10l14 21Z"/><path d="M24 26l5 6l4-7"/>',
      historic: '<path d="M15 51h34"/><path d="M19 47V23l13-8l13 8v24"/><path d="M25 47V34h14v13"/><path d="M19 25h26"/>',
      fire: '<path d="M32 54c-9-4-14-10-14-18c0-8 6-13 11-19c0 8 6 10 9 15c2-4 4-7 8-10c1 7 2 11 2 16c0 8-6 13-16 16Z"/><path d="M32 48c-4-2-6-5-6-9c0-4 3-6 6-10c1 5 5 7 5 11c0 3-2 6-5 8Z"/>',
      conflict: '<path d="M32 8v48M8 32h48M20 20l24 24M44 20L20 44"/><circle cx="32" cy="32" r="12"/>',
      car: '<path d="M16 39h32l-4-12H20Z"/><path d="M19 39v8h6v-5h14v5h6v-8"/><circle cx="24" cy="47" r="3"/><circle cx="40" cy="47" r="3"/>',
      point: '<circle cx="32" cy="32" r="18"/>',
    };
    const aliases = {
      airport: 'airplane',
      aircraft: 'airplane',
      vessel: 'ship',
      vehicle: 'car',
      'speed-camera': 'speedCamera',
      mountain: 'terrain',
      water: 'ship',
      landmark: 'historic',
      ruins: 'historic',
      warning: 'conflict',
      police: 'car',
      subway: 'train',
      station: 'train',
    };
    const normalizedKind = paths[kind] ? kind : aliases[kind];
    const path = paths[normalizedKind] || paths.point;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><g fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${path}</g></svg>`;
    return {
      image: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      width: 30,
      height: 30,
      verticalOrigin: this.Cesium.VerticalOrigin.BOTTOM,
      disableDepthTestDistance: 800000,
    };
  }

  _gtfsVehicles(data) {
    return (data.entity || data.entities || []).map((entry) => {
      const vehicle = entry.vehicle || entry;
      const pos = vehicle.position || {};
      return {
        id: entry.id || vehicle.vehicle?.id || vehicle.trip?.tripId || Math.random().toString(36),
        lat: Number(pos.latitude ?? vehicle.lat),
        lon: Number(pos.longitude ?? vehicle.lon),
        label: vehicle.vehicle?.label || vehicle.trip?.routeId || 'Train',
      };
    }).filter((v) => Number.isFinite(v.lat) && Number.isFinite(v.lon));
  }

  _cameraBbox() {
    const camera = this.viewer.camera;
    const center = camera.positionCartographic;
    const lat = this.Cesium.Math.toDegrees(center.latitude);
    const lon = this.Cesium.Math.toDegrees(center.longitude);
    const span = Math.max(0.04, Math.min(1.5, (center.height || 10000) / 250000));
    return { south: lat - span, north: lat + span, west: lon - span, east: lon + span };
  }

  _enableEntityClustering(layer) {
    const source = new this.Cesium.CustomDataSource(`${layer.id}-cluster`);
    for (const entity of layer.items.splice(0)) source.entities.add(entity);
    source.clustering.enabled = true;
    source.clustering.pixelRange = 48;
    source.clustering.minimumClusterSize = 4;
    this.viewer.dataSources.add(source);
    layer.items.push(source);
  }

  _smogParticleSystem(lon, lat, strength) {
    const primitive = this.viewer.scene.primitives.add(new this.Cesium.ParticleSystem({
      image: this._particleCanvas(),
      startColor: this.Cesium.Color.SANDYBROWN.withAlpha(0.22 * strength),
      endColor: this.Cesium.Color.GRAY.withAlpha(0.02),
      particleLife: 8,
      speed: 3,
      imageSize: new this.Cesium.Cartesian2(18, 18),
      emissionRate: 30 * strength,
      emitter: new this.Cesium.CircleEmitter(1800),
      modelMatrix: this.Cesium.Transforms.eastNorthUpToFixedFrame(
        this.Cesium.Cartesian3.fromDegrees(lon, lat, 900),
      ),
    }));
    return primitive;
  }

  _particleCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(16, 16, 1, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255,220,160,.8)');
    gradient.addColorStop(1, 'rgba(255,220,160,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
    return canvas;
  }

  async _loadEarthquakes(layer) {
    const data = await this.fetchJson(this.endpoints.usgsEarthquakes);
    const cutoff = this.now() - 24 * 60 * 60 * 1000;
    for (const feature of data.features || []) {
      if ((feature.properties?.time || 0) < cutoff) continue;
      const [lon, lat] = feature.geometry?.coordinates || [];
      const mag = Number(feature.properties?.mag || 1);
      layer.items.push(this.viewer.entities.add({
        name: `M${mag.toFixed(1)} earthquake`,
        position: this.Cesium.Cartesian3.fromDegrees(lon, lat, 50),
        ellipse: {
          semiMajorAxis: new this.Cesium.CallbackProperty(() => 2500 + ((this.now() / 18) % 20000) * mag, false),
          semiMinorAxis: new this.Cesium.CallbackProperty(() => 2500 + ((this.now() / 18) % 20000) * mag, false),
          material: this.Cesium.Color.RED.withAlpha(0.18),
          outline: true,
          outlineColor: this.Cesium.Color.RED,
        },
      }));
    }
  }

  async _loadFires(layer) {
    const data = await this.fetchJson(this.endpoints.firms);
    for (const fire of (data.features || data.fires || []).slice(0, 300)) {
      const coords = fire.geometry?.coordinates || [fire.lon ?? fire.longitude, fire.lat ?? fire.latitude];
      const [lon, lat] = coords;
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
      layer.items.push(this.viewer.entities.add({
        name: fire.properties?.label || 'NASA FIRMS fire',
        position: this.Cesium.Cartesian3.fromDegrees(lon, lat, 40),
        billboard: this._svgBillboard(this.icons.fire, this.colors.fire),
        ellipse: {
          semiMajorAxis: 900,
          semiMinorAxis: 900,
          material: this.Cesium.Color.fromCssColorString(this.colors.fire).withAlpha(0.25),
        },
      }));
    }
  }

  _circleDegrees(lon, lat, radiusMeters, segments = 64) {
    const coords = [];
    const earth = 6378137;
    const latRad = this.Cesium.Math.toRadians(lat);
    for (let i = 0; i < segments; i += 1) {
      const a = (i / segments) * Math.PI * 2;
      coords.push([
        lon + this.Cesium.Math.toDegrees((Math.cos(a) * radiusMeters) / (earth * Math.cos(latRad))),
        lat + this.Cesium.Math.toDegrees((Math.sin(a) * radiusMeters) / earth),
      ]);
    }
    return coords;
  }

  _timelineVisible(entity, value) {
    const start = Number(entity.properties?.start?.getValue?.() ?? 0);
    const end = Number(entity.properties?.end?.getValue?.() ?? 1);
    return value >= start && value <= end;
  }

  _fallbackPoint(layer, lon, lat, label) {
    layer.items.push(this.viewer.entities.add({
      name: label,
      position: this.Cesium.Cartesian3.fromDegrees(lon, lat, 1000),
      point: { pixelSize: 10, color: this.Cesium.Color.YELLOW },
      label: this._nearLabel(label, 10000000),
    }));
  }

  _escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[char]));
  }
}

export default OpenDataLayerSuite;
