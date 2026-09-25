const PLACEHOLDER_KEY_VALUES = new Set([
  'your_google_maps_api_key_here',
  'your_cesium_ion_token_here',
  'google_maps_api_key',
  'cesium_ion_token',
]);

export const cleanCredential = (value) => {
  const text = String(value || '').trim();
  if (!text) return '';
  if (PLACEHOLDER_KEY_VALUES.has(text.toLowerCase())) return '';
  return text;
};

/**
 * Decide which map provider can deliver the best startup experience.
 * @param {{googleApiKey?: string, cesiumToken?: string}} credentials
 * @returns {'google-direct'|'google-ion'|'osm'}
 */
export function selectMapStartupRoute({ googleApiKey = '', cesiumToken = '' } = {}) {
  if (cleanCredential(googleApiKey)) return 'google-direct';
  if (cleanCredential(cesiumToken)) return 'google-ion';
  return 'osm';
}

/**
 * Load Google Photorealistic 3D Tiles through direct Google access when
 * configured, otherwise through Cesium ion's hosted Google asset. If the
 * direct request fails and an ion token is available, ion is the recovery path.
 *
 * @param {object} Cesium
 * @param {{googleApiKey?: string, cesiumToken?: string}} credentials
 * @returns {Promise<{tileset: object|null, route: 'google-direct'|'google-ion'|'osm', errors: Error[]}>}
 */
export async function loadPhotorealisticTileset(
  Cesium,
  { googleApiKey = '', cesiumToken = '' } = {},
) {
  const googleKey = cleanCredential(googleApiKey);
  const ionToken = cleanCredential(cesiumToken);
  const errors = [];

  if (ionToken) Cesium.Ion.defaultAccessToken = ionToken;

  const attempts = [];
  if (googleKey) attempts.push({ route: 'google-direct', googleKey });
  if (ionToken) attempts.push({ route: 'google-ion', googleKey: undefined });

  for (const attempt of attempts) {
    Cesium.GoogleMaps.defaultApiKey = attempt.googleKey;
    try {
      const tileset = await Cesium.createGooglePhotorealistic3DTileset(
        {
          onlyUsingWithGoogleGeocoder: true,
          ...(attempt.googleKey ? { key: attempt.googleKey } : {}),
        },
        {
          showCreditsOnScreen: true,
          maximumScreenSpaceError: 18,
          dynamicScreenSpaceError: true,
          cullWithChildrenBounds: true,
          skipLevelOfDetail: true,
        },
      );
      return { tileset, route: attempt.route, errors };
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }
  }

  Cesium.GoogleMaps.defaultApiKey = undefined;
  return { tileset: null, route: 'osm', errors };
}
