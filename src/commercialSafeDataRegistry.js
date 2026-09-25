export const RISK_COLOR_SCALE = Object.freeze({
  good: '#28f07d',
  caution: '#ffd54a',
  warning: '#ff9f1a',
  bad: '#ff3b30',
  severe: '#b14cff',
  unknown: '#9aa7b2',
});

export const LAYER_COLORS = Object.freeze({
  aircraft: '#7ad7ff',
  helicopter: '#5de2ff',
  vehicle: '#ffcf5a',
  vessel: '#4aa3ff',
  train: '#43f58f',
  subway: '#b58cff',
  airport: '#9fdcff',
  station: '#43f58f',
  hospital: '#ff5f7a',
  shelter: '#28f07d',
  police: '#4aa3ff',
  fire: '#ff7a18',
  camera: '#55dff5',
  speedCamera: '#ffd54a',
  worship: '#c78cff',
  mountain: '#79d45b',
  sea: '#2f9bff',
  strait: '#2fd7ff',
  heritage: '#d8b26e',
  ruins: '#9aa7b2',
  aqiGood: RISK_COLOR_SCALE.good,
  aqiCaution: RISK_COLOR_SCALE.caution,
  aqiBad: RISK_COLOR_SCALE.bad,
  disaster: RISK_COLOR_SCALE.severe,
});

export const LAYER_ICONS = Object.freeze({
  aircraft: 'airplane',
  helicopter: 'helicopter',
  vehicle: 'car',
  vessel: 'ship',
  train: 'train',
  subway: 'subway',
  airport: 'airport',
  station: 'station',
  hospital: 'hospital',
  shelter: 'shelter',
  police: 'police',
  fire: 'fire',
  camera: 'camera',
  speedCamera: 'speed-camera',
  worship: 'worship',
  mountain: 'mountain',
  sea: 'water',
  strait: 'water',
  heritage: 'landmark',
  ruins: 'ruins',
  crosshair: 'crosshair',
  warning: 'warning',
});

export const SAFE_DATA_SOURCES = Object.freeze({
  osm: {
    name: 'OpenStreetMap',
    scope: 'global POI, roads, rail, cameras, hospitals, shelters, terrain names',
    license: 'ODbL 1.0',
    commercialUse: 'allowed-with-attribution-sharealike',
    attribution: '© OpenStreetMap contributors',
    url: 'https://www.openstreetmap.org/copyright',
    defaultUse: true,
    notes: 'Do not scrape Google/Apple/Flock-derived POIs into OSM-derived layers.',
  },
  naturalEarth: {
    name: 'Natural Earth',
    scope: 'country borders, coastlines, physical geography',
    license: 'Public Domain',
    commercialUse: 'allowed',
    attribution: 'Made with Natural Earth',
    url: 'https://www.naturalearthdata.com/about/terms-of-use/',
    defaultUse: true,
  },
  ourAirports: {
    name: 'OurAirports',
    scope: 'global airports, heliports, runways, navaids',
    license: 'Public Domain',
    commercialUse: 'allowed',
    attribution: 'OurAirports',
    url: 'https://ourairports.com/data/',
    defaultUse: true,
  },
  usgsEarthquakes: {
    name: 'USGS Earthquake Feeds',
    scope: 'global real-time earthquake GeoJSON',
    license: 'US public data',
    commercialUse: 'allowed-with-attribution',
    attribution: 'U.S. Geological Survey',
    url: 'https://earthquake.usgs.gov/earthquakes/feed/',
    defaultUse: true,
  },
  nasaFirms: {
    name: 'NASA FIRMS',
    scope: 'global active fires and thermal anomalies',
    license: 'NASA EOSDIS data terms',
    commercialUse: 'allowed-with-attribution-key-required',
    attribution: 'NASA FIRMS / EOSDIS',
    url: 'https://firms.modaps.eosdis.nasa.gov/active_fire',
    requiresKey: true,
    defaultUse: true,
  },
  openAq: {
    name: 'OpenAQ',
    scope: 'global air quality measurements from public sources',
    license: 'source-specific, commonly CC BY 4.0',
    commercialUse: 'check-license-record',
    attribution: 'OpenAQ and original data providers',
    url: 'https://docs.openaq.org/resources/licenses',
    defaultUse: true,
  },
  rainviewer: {
    name: 'RainViewer',
    scope: 'global precipitation radar tiles where available',
    license: 'RainViewer terms',
    commercialUse: 'check-current-terms',
    attribution: 'RainViewer',
    url: 'https://www.rainviewer.com/api/weather-maps-api.html',
    defaultUse: true,
  },
  celestrak: {
    name: 'CelesTrak',
    scope: 'space station and satellite TLEs',
    license: 'CelesTrak terms',
    commercialUse: 'allowed-with-attribution',
    attribution: 'CelesTrak / Dr. T.S. Kelso',
    url: 'https://celestrak.org',
    defaultUse: true,
  },
  aisUserProvided: {
    name: 'User-provided AIS feed',
    scope: 'public vessel positions when licensed by feed provider',
    license: 'provider-specific',
    commercialUse: 'bring-your-own-license',
    attribution: 'AIS provider attribution required',
    defaultUse: false,
  },
});

export const EXCLUDED_SOURCES = Object.freeze({
  liveEmergencyVehicles: 'Avoid live police/fire/ambulance vehicle locations unless an agency explicitly publishes a licensed public feed.',
  personTracking: 'Avoid identifying or tracking individual people. Use aggregated activity estimates only.',
  flockCameraScrape: 'Do not scrape proprietary Flock/Pelican-style camera datasets; use OSM/public agency camera points only.',
  carrierTrackingClaims: 'Do not claim aircraft-carrier tracking unless present in a licensed public AIS/source feed.',
  googleDerivedPoi: 'Do not copy POIs, street-view imagery, labels, or geometry from Google into open layers.',
});

export function safetyColor(scoreOrTier) {
  if (typeof scoreOrTier === 'string') return RISK_COLOR_SCALE[scoreOrTier] || RISK_COLOR_SCALE.unknown;
  const score = Number(scoreOrTier);
  if (!Number.isFinite(score)) return RISK_COLOR_SCALE.unknown;
  if (score < 20) return RISK_COLOR_SCALE.good;
  if (score < 45) return RISK_COLOR_SCALE.caution;
  if (score < 70) return RISK_COLOR_SCALE.warning;
  if (score < 90) return RISK_COLOR_SCALE.bad;
  return RISK_COLOR_SCALE.severe;
}

export function sourceCreditHtml(sourceKey) {
  const source = SAFE_DATA_SOURCES[sourceKey];
  if (!source) return '';
  const label = source.attribution || source.name;
  return source.url
    ? `${label}: <a href="${source.url}" target="_blank" rel="noopener">${source.name}</a>`
    : `${label}: ${source.name}`;
}
