export const COMPACT_MAP_QUERY = '(max-width: 760px), (max-width: 950px) and (max-height: 500px)';
const PANEL_IDS = ['data-panel', 'scene-panel', 'pp-toggles', 'cctv-panel', 'global-context-panel'];

export function initCompactPanels(doc = document, media = window.matchMedia(COMPACT_MAP_QUERY)) {
  const expanded = id => {
    const panel = doc.getElementById(id);
    return panel && !panel.classList.contains('collapsed');
  };
  const closeOthers = keep => {
    for (const id of PANEL_IDS) {
      if (id !== keep && expanded(id)) {
        doc.getElementById(id).querySelector(`[data-collapse-target="${id}"]`)?.click();
      }
    }
  };
  const normalize = () => {
    if (!media.matches || doc.body.classList.contains('cockpit-mode')) return;
    const world = doc.getElementById('world-connect-panel');
    closeOthers(world && !world.hidden ? null : PANEL_IDS.find(expanded));
  };
  const onClick = event => {
    if (!media.matches || doc.body.classList.contains('cockpit-mode')) return;
    const target = event.target.closest?.('[data-collapse-target], #world-connect-toggle');
    if (!target) return;
    if (target.id === 'world-connect-toggle') {
      if (doc.getElementById('world-connect-panel')?.hidden) closeOthers(null);
      return;
    }
    const id = target.dataset.collapseTarget;
    if (!PANEL_IDS.includes(id) || expanded(id)) return;
    closeOthers(id);
    const world = doc.getElementById('world-connect-panel');
    if (world && !world.hidden) world.querySelector('header button')?.click();
  };
  // Reuse the real panel controls so timers, saved state and cleanup stay in sync.
  doc.addEventListener('click', onClick, true);
  media.addEventListener('change', normalize);
  normalize();
  return () => {
    doc.removeEventListener('click', onClick, true);
    media.removeEventListener('change', normalize);
  };
}
