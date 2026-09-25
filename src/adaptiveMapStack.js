const FAR_GLOBE_ALTITUDE_M = 2_600_000;
const NEAR_MAP_ALTITUDE_M = 1_500_000;

function cameraHeight(viewer) {
  const height = viewer?.camera?.positionCartographic?.height;
  return Number.isFinite(height) ? height : Number.POSITIVE_INFINITY;
}

function preferredStackForHeight(heightM, activeId) {
  if (heightM >= FAR_GLOBE_ALTITUDE_M) return 'nasa-blue-marble';
  if (heightM <= NEAR_MAP_ALTITUDE_M) return 'esri-imagery';
  return activeId;
}

export function initAdaptiveMapStack({
  viewer,
  mapStackController,
  onStateChange = null,
} = {}) {
  if (!viewer?.camera || !mapStackController) return null;

  let switching = false;
  let queued = false;
  let timer = 0;

  const reconcile = async () => {
    timer = 0;
    if (switching) {
      queued = true;
      return;
    }

    const activeId = mapStackController.getActiveId();
    if (!['nasa-blue-marble', 'esri-imagery', 'osm'].includes(activeId)) return;

    const nextId = preferredStackForHeight(cameraHeight(viewer), activeId);
    if (!nextId || nextId === activeId) return;
    if (!mapStackController.isStackAvailable(nextId)) return;

    switching = true;
    try {
      const state = await mapStackController.setStack(nextId, { silent: true });
      onStateChange?.(state);
      window.dispatchEvent(new CustomEvent('gev:map-stack-changed', { detail: state }));
    } catch (error) {
      console.warn('[AdaptiveMapStack]', error);
    } finally {
      switching = false;
      if (queued) {
        queued = false;
        schedule(40);
      }
    }
  };

  const schedule = (delayMs = 180) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(reconcile, delayMs);
  };

  const removeChanged = viewer.camera.changed?.addEventListener?.(() => schedule());
  const removeMoveEnd = viewer.camera.moveEnd?.addEventListener?.(() => schedule(20));
  schedule(20);

  return {
    update: () => schedule(0),
    destroy: () => {
      if (timer) clearTimeout(timer);
      removeChanged?.();
      removeMoveEnd?.();
    },
  };
}
