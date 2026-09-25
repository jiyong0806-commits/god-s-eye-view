import * as Cesium from 'cesium';
import { StyleManager } from './ui.js';
import { flyToSeoul } from './camera.js';
import { DataLayerManager } from './data/manager.js';
import { installProviderHealth } from './data/providerHealth.js';
import flightsLayer from './data/flights.js';
import militaryFlightsLayer from './data/militaryFlights.js';
import earthquakesLayer from './data/earthquakes.js';
import satellitesLayer from './data/satellites.js';
import rocketLaunchesLayer from './data/rocketLaunches.js';
import trafficLayer from './data/traffic.js';
import peopleActivityLayer from './data/peopleActivity.js';
import temperatureLayer from './data/temperature.js';
import cctvLayer from './data/cctv.js';
import radioLayer from './data/radio.js';
import bikeshareLayer from './data/bikeshare.js';
import aisLiveVesselsLayer from './data/aisLiveVessels.js';
import militaryInstallationsLayer from './data/militaryInstallations.js';
import militaryAwarenessLayer from './data/militaryAwareness.js';
import localDataLayers from './data/localLayers.js';
import { LAYER_STATE_REGISTRY } from './data/layerState.js';
import { registerDataCredits } from './data/dataCredits.js';
import { SceneDirector } from './scenes/director.js';
import { initGevVoiceCommands } from './voice/gevRealtime.js';
import { initFreeVoice, shouldUseFreeVoice } from './voice/freeVoice.js';
import { MapStackController } from './mapStackController.js';
import { initAdaptiveMapStack } from './adaptiveMapStack.js';
import { initAnnotations } from './annotations/index.js';
import { initLogoGaze } from './logoGaze.js';
import { initStreetPhotoPanel } from './streetPhotoPanel.js';
import { initPlasmaBgm } from './plasmaBgm.js';
import { initPlasmaControls } from './plasmaControls.js';
import { initCockpitCloudEffects } from './cockpitCloudEffects.js';
import {
  installRenderGovernor,
  getRenderGovernorDiagnostics,
  governorRequestRender,
  holdContinuousRender,
  releaseContinuousRender,
} from './renderGovernor.js';
import { installScopeMask } from './scopeMask.js';
import { initFirstRunExperience } from './firstRunExperience.js';
import { initKeySetup } from './keySetup.js';
import { cleanCredential, loadPhotorealisticTileset } from './mapStartup.js';

installProviderHealth();
initLogoGaze();
initPlasmaBgm();
initPlasmaControls();

if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  window.addEventListener('load', () => {
    const reloadOnceAfterControl = () => {
      const key = 'gev-sw-controlled-reload-v4';
      if (navigator.serviceWorker.controller || sessionStorage.getItem(key) === '1') return;
      sessionStorage.setItem(key, '1');
      window.location.reload();
    };

    navigator.serviceWorker.register('/sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then(() => reloadOnceAfterControl())
      .catch((error) => {
        console.warn('[PWA] service worker registration failed:', error?.message || error);
      });

    navigator.serviceWorker.addEventListener('controllerchange', reloadOnceAfterControl);
  });
}

async function loadOpenBuildingsLayer(viewer, googleTileset) {
  if (!viewer || googleTileset) return null;
  if (window.__godsEyeView?.openBuildings) return window.__godsEyeView.openBuildings;
  try {
    const buildings = await Cesium.Cesium3DTileset.fromUrl('https://buildings.reearth.land/tileset.json', {
      maximumScreenSpaceError: 28,
      dynamicScreenSpaceError: true,
      cullWithChildrenBounds: true,
      skipLevelOfDetail: true,
    });
    buildings.show = true;
    buildings.style = new Cesium.Cesium3DTileStyle({
      color: 'color("#d9f7ff", 0.42)',
    });
    viewer.scene.primitives.add(buildings);
    window.__godsEyeView = window.__godsEyeView || {};
    window.__godsEyeView.openBuildings = buildings;
    governorRequestRender('open-buildings');
    return buildings;
  } catch (error) {
    console.warn('[OpenBuildings] free 3D buildings failed:', error?.message || error);
    return null;
  }
}

function initOpenBuildingsToggle(viewer, googleTileset, enabledByDefault = false) {
  const button = document.getElementById('open-buildings-toggle');
  if (!button) return;
  let loading = false;
  const setActive = (active) => {
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  };
  const setLabel = (text) => {
    const label = button.querySelector('.pp-label');
    if (label) label.textContent = text;
  };
  const toggle = async (force) => {
    if (loading) return;
    const current = window.__godsEyeView?.openBuildings;
    const nextVisible = typeof force === 'boolean' ? force : !current?.show;
    if (current) {
      current.show = nextVisible;
      setActive(nextVisible);
      governorRequestRender('open-buildings-toggle');
      return;
    }
    if (!nextVisible) {
      setActive(false);
      return;
    }
    loading = true;
    setLabel('로딩');
    const buildings = await loadOpenBuildingsLayer(viewer, googleTileset);
    loading = false;
    setLabel('건물');
    setActive(Boolean(buildings?.show));
  };
  button.addEventListener('click', () => void toggle());
  window.__godsEyeView = window.__godsEyeView || {};
  window.__godsEyeView.toggleOpenBuildings = toggle;
  setActive(false);
  if (enabledByDefault) window.setTimeout(() => void toggle(true), 1800);
}

function envFlag(name, defaultValue = false) {
  const raw = import.meta.env[name];
  if (raw === undefined || raw === null || raw === '') return defaultValue;
  return !/^(0|false|off|no)$/i.test(String(raw));
}

/**
 * Extract a human-readable error message from any thrown value.
 * Handles Error objects, strings, and plain objects with message/error fields.
 * @param {*} error — caught exception value
 * @returns {string} best-effort error description
 */
function describeError(error) {
  if (!error) return 'Unknown initialization error';
  if (error instanceof Error) {
    if (error.message && error.message.trim()) return error.message.trim();
    return error.name || 'Initialization error';
  }
  if (typeof error === 'string' && error.trim()) return error.trim();
  if (typeof error === 'object') {
    const maybeMessage = String(error.message || error.error || '').trim();
    if (maybeMessage) return maybeMessage;
    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== '{}') return serialized;
    } catch {
      // ignore serialization error
    }
  }
  return String(error);
}

/**
 * GOD'S EYE VIEW — Main Entry Point
 * Initializes CesiumJS with Google Photorealistic 3D Tiles,
 * style system, intelligence HUD, location presets, and share links.
 */
async function init() {
  const loadingScreen = document.getElementById('loading-screen');
  const loaderStatus = loadingScreen.querySelector('.loader-status');

  try {
    loaderStatus.textContent = 'Configuring viewer...';

    // A direct Google key provides Google 3D plus GEV place search. Cesium ion
    // can host the same 3D tiles and also powers Bing/world-terrain stacks.
    const lightMode = envFlag('GEV_LIGHT_MODE', false);
    const offlineMode = envFlag('GEV_OFFLINE_MODE', false);
    const autoOpenBuildings = envFlag('GEV_AUTO_OPEN_BUILDINGS', false);
    const cesiumToken = lightMode || offlineMode ? '' : cleanCredential(import.meta.env.CESIUM_ION_TOKEN);
    const googleApiKey = lightMode || offlineMode ? '' : cleanCredential(import.meta.env.GOOGLE_MAPS_API_KEY);
    if (googleApiKey) window.__GOOGLE_MAPS_API_KEY__ = googleApiKey;

    // Create the Cesium viewer with minimal chrome
    const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    const viewer = new Cesium.Viewer('cesiumContainer', {
      timeline: false,
      animation: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      vrButton: false,
      selectionIndicator: false,
      infoBox: false,
      baseLayer: false,
      // Visible attribution container — Google Maps / 3D Tiles credits are
      // required by Google's Terms of Service, so they must be shown (styled
      // subtly via #cesium-credits). The credit line stays visible in
      // clean-view AND recording modes too (ToS requires attribution while the
      // content is displayed — those are the exact modes used to record
      // demos), including the "Data attribution" link that opens the per-layer
      // license popover.
      creditContainer: (() => {
        const el = document.createElement('div');
        el.id = 'cesium-credits';
        document.body.appendChild(el);
        return el;
      })(),
      msaaSamples: coarsePointer ? 2 : 4,
      contextOptions: {
        webgl: {
          preserveDrawingBuffer: true,
        },
      },
    });

    // Cap the default render loop at 60 fps on desktop and 30 fps on touch
    // devices. Cesium's loop otherwise runs at
    // the display's refresh rate — 120 Hz on ProMotion panels — doubling GPU
    // and CPU burn for zero visual benefit in a map app whose animation
    // cadences (poll interpolation, trail fades, style crossfades) are all
    // designed against wall-clock time, not frame count. Measured on the
    // 2026-08-05 perf investigation as a strict halving of idle burn on
    // 120 Hz hardware; a no-op on 60 Hz displays. (perf item 2)
    viewer.targetFrameRate = coarsePointer ? 30 : 60;

    // Register per-layer data attribution into the "Data attribution" popover.
    // Required by each source's license (ODbL, CC BY-NC-SA, NASA FIRMS, etc.);
    // strings are verbatim from DATA_SOURCES.md. Static + always-present in the
    // expandable bottom-left credit lightbox (showOnScreen=false), so they never
    // clutter the on-globe line. See docs/pre-ship-audit-2026-07-01.md H11.
    registerDataCredits(viewer);

    // Hide Cesium's default globe — Google Photorealistic 3D Tiles provide their own
    // globe at all LODs (street level → orbital). The default globe's 2D imagery
    // clips through 3D tile buildings at close range.
    viewer.scene.globe.show = false;

    // Keep a sky behind Google 3D Tiles, but soften Cesium's high-intensity
    // default atmosphere. With the globe hidden its bright limb otherwise
    // reads as a hard cyan seam where distant photoreal tiles meet the sky.
    viewer.scene.skyAtmosphere.show = true;
    viewer.scene.skyAtmosphere.atmosphereLightIntensity = 18;
    viewer.scene.skyAtmosphere.saturationShift = -0.12;
    viewer.scene.skyAtmosphere.brightnessShift = -0.08;

    loaderStatus.textContent = googleApiKey || cesiumToken
      ? 'Google 3D 타일 로딩 중...'
      : '무료 NASA 지구 이미지로 시작 중...';
    const photoreal = lightMode || offlineMode
      ? { tileset: null, route: 'offline', errors: [] }
      : await loadPhotorealisticTileset(Cesium, { googleApiKey, cesiumToken });
    const tileset = photoreal.tileset;
    if (tileset) {
      viewer.scene.primitives.add(tileset);
      // NOTE: Cesium World Terrain intentionally disabled — conflicts with Google 3D Tiles at high zoom.
      // Google Photorealistic 3D Tiles provide their own terrain/elevation.
      viewer.scene.globe.show = false;
      console.info(`[Init] Google 3D Tiles loaded via ${photoreal.route}.`);
    } else {
      if (photoreal.errors.length) {
        const tileError = photoreal.errors.at(-1);
        console.warn('[Init] Google 3D Tiles unavailable, using the keyless globe:', tileError);
        const tileErrorDetail = describeError(tileError);
        loaderStatus.textContent = `Google 3D 사용 불가 (${tileErrorDetail}). 무료 지구본으로 전환 중...`;
      }
      viewer.scene.globe.show = true;
    }

    loaderStatus.textContent = '시스템 초기화 중...';

    const mapStackController = new MapStackController(viewer, {
      googleTileset: tileset,
      cesiumToken,
      initialStack: tileset ? 'photoreal' : 'nasa-blue-marble',
      // Task 5 (height-datum fix): rebroadcast stack changes as a window
      // CustomEvent so data layers (CCTV per-regime ground resolution) can
      // react without coupling MapStackController to layer modules. Fires on
      // 'switching'/'ready'/'error'; listeners derive the surface regime from
      // live scene state, so intermediate emissions are harmless.
      onChange: (state) => {
        window.dispatchEvent(new CustomEvent('gev:map-stack-changed', { detail: state }));
      },
      onError: (message) => console.warn('[MapStack]', message),
    });
    await mapStackController.setStack(tileset ? 'photoreal' : 'nasa-blue-marble', { silent: true });

    // Initialize the style manager (post-processing, HUD, locations, share links)
    const styleManager = new StyleManager(viewer, { mapStackController });
    // The previous multi-canvas weather compositor remains disabled. Cockpit
    // clouds use a separate, capped low-resolution GPU pass that never attaches
    // Cesium fog or post-process stages and is fully stopped in map mode.
    const weatherEffects = null;
    const cockpitCloudEffects = initCockpitCloudEffects(viewer);
    initAdaptiveMapStack({
      viewer,
      mapStackController,
      onStateChange: (state) => styleManager._renderMapStackState?.(state),
    });
    const streetPhotoPanel = initStreetPhotoPanel({ viewer });
    initOpenBuildingsToggle(viewer, tileset, autoOpenBuildings);

    // If no share link state, do default fly-to Seoul
    if (!styleManager.hasShareState) {
      loaderStatus.textContent = '서울로 이동 중...';
      flyToSeoul(viewer);
    } else {
      loaderStatus.textContent = '공유된 화면 복원 중...';
    }

    // Initialize data layer manager
    const dataManager = new DataLayerManager(viewer, {
      allowQaRegistration: import.meta.env.DEV,
    });
    dataManager.register(flightsLayer);
    dataManager.register(militaryFlightsLayer);
    dataManager.register(earthquakesLayer);
    dataManager.register(satellitesLayer);
    dataManager.register(rocketLaunchesLayer);
    rocketLaunchesLayer.attachDataManager(dataManager);
    dataManager.register(trafficLayer);
    dataManager.register(peopleActivityLayer);
    dataManager.register(temperatureLayer);
    dataManager.register(cctvLayer);
    dataManager.register(radioLayer);
    dataManager.register(bikeshareLayer);
    dataManager.register(aisLiveVesselsLayer);
    dataManager.register(militaryInstallationsLayer);
    dataManager.register(militaryAwarenessLayer);
    militaryAwarenessLayer.attachDataManager(dataManager);
    for (const layer of localDataLayers) {
      dataManager.register(layer);
    }
    // Restoration starts only after the complete production registry is sealed.
    dataManager.finalizeRegistrations(LAYER_STATE_REGISTRY);
    if (import.meta.env.DEV) {
      window.__gevQaRegisterLayer = (targetManager, layerModule) => {
        if (targetManager !== dataManager) throw new Error('QA layer manager mismatch');
        return dataManager.registerForQa(layerModule);
      };
      window.__gevQaUnregisterLayer = (targetManager, layerId) => {
        if (targetManager !== dataManager) throw new Error('QA layer manager mismatch');
        return dataManager.unregisterForQa(layerId);
      };
    }
    dataManager.buildTogglePanel(document.getElementById('data-toggles'));
    styleManager.attachDataManager(dataManager);

    // Initialize deterministic scene playback for social clip capture
    const sceneDirector = new SceneDirector(viewer, styleManager, dataManager);

    // Initialize the voice "whiteboard" annotation engine (world-space renderer)
    const annotations = initAnnotations({ viewer, tileset });

    // The globe is usable before slower layer feeds settle.
    void Promise.race([
      Promise.resolve(styleManager.initialRestorePromise).catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 1800)),
    ]).finally(() => {
      loadingScreen.classList.add('hidden');
      // Reveal only after the loading cover has yielded. transitionend can be
      // absent under reduced motion, so a bounded fallback makes this reliable.
      let firstRunRevealed = false;
      const revealFirstRun = () => {
        if (firstRunRevealed) return;
        firstRunRevealed = true;
        // dataManager is passed explicitly: the globe missions enable bundled
        // keyless layers through it, and reaching for styleManager._dataManager
        // would make a private field part of this feature's contract.
        initFirstRunExperience({ styleManager, dataManager });
      };
      loadingScreen.addEventListener('transitionend', revealFirstRun, { once: true });
      setTimeout(revealFirstRun, 900);
    });

    // Provider Settings (the POWER UP chip + dialog). Fire-and-forget: the
    // module removes its own surface when the dev-server endpoint is absent
    // (prod builds, non-local visitors), so this costs prod exactly nothing.
    void initKeySetup();

    // Expose for debugging
    // Idle render governor: flips the scene into requestRenderMode whenever
    // nothing animates per frame. Installed AFTER every module above has had
    // its chance to register pre-install holds. (perf wave 2)
    installRenderGovernor(viewer);

    // The explicit scope mask replaces the emergent six-pass artifact —
    // see src/scopeMask.js. Installed before the UI so the DISPLAY-rail
    // toggle finds it live.
    installScopeMask(viewer);

    // The follow camera recomputes the tracked target's dead-reckon position
    // every frame — tracking anything is a per-frame animation. (perf wave 2)
    viewer.trackedEntityChanged.addEventListener(() => {
      if (viewer.trackedEntity) holdContinuousRender('tracked-entity');
      else releaseContinuousRender('tracked-entity');
    });

    // Hidden-state suspension (perf wave 2): when the window/tab is hidden,
    // stop the default render loop outright — a hidden canvas repaints for
    // nobody, and browser rAF throttling still lets throttled frames burn
    // GPU. Holder/data state is untouched, so return is seamless: restore
    // the loop, refresh the one DOM surface we gated, render a frame.
    const syncVisibilitySuspension = () => {
      const hidden = document.hidden;
      viewer.useDefaultRenderLoop = !hidden;
      cockpitCloudEffects?.setSuspended?.(hidden);
      if (!hidden) {
        if (dataManager._panelRefreshPendingOnVisible) {
          dataManager._panelRefreshPendingOnVisible = false;
          dataManager._refreshTogglePanel();
        }
        governorRequestRender('visibility-restore');
      }
    };
    document.addEventListener('visibilitychange', syncVisibilitySuspension);
    // Apply the CURRENT state too — bootstrap can complete while the tab is
    // already hidden, and waiting for the next transition would leave the
    // loop burning behind a hidden tab. (perf wave 2 fix)
    syncVisibilitySuspension();

    window.__godsEyeView = {
      viewer,
      styleManager,
      tileset,
      dataManager,
      sceneDirector,
      mapStackController,
      streetPhotoPanel,
      annotations,
      weatherEffects,
      cockpitCloudEffects,
      getRenderGovernorDiagnostics,
      requestRender: governorRequestRender,
    };
    const openAiVoiceReady = Boolean(import.meta.env.OPENAI_API_KEY);
    if (openAiVoiceReady) {
      window.__godsEyeView.voiceCommands = initGevVoiceCommands({ viewer, styleManager, dataManager, sceneDirector, annotations });
    } else {
      window.__godsEyeView.voiceCommands = null;
    }
    window.__godsEyeView.freeVoice = initFreeVoice({ viewer, styleManager, dataManager, sceneDirector, annotations });

    const realtimeReady = openAiVoiceReady;
    const speechSupported = window.__godsEyeView.freeVoice?.isSupported?.() === true;
    if (shouldUseFreeVoice({ realtimeReady, speechSupported })) {
      const voiceButton = document.getElementById('gev-voice-button');
      voiceButton?.addEventListener('click', () => window.__godsEyeView.freeVoice?.toggle?.());
    }

  } catch (error) {
    console.error("God's Eye View initialization failed:", error);
    loaderStatus.textContent = `Error: ${describeError(error)}`;
    loaderStatus.style.color = '#ff4444';
  }
}

init();
