import assert from 'node:assert/strict';
import test from 'node:test';
import { initCompactPanels } from './compactPanels.js';

function fixture(mobile = true) {
  const listeners = new Map(), changes = new Set(), nodes = new Map();
  const media = { matches: mobile, addEventListener: (_, fn) => changes.add(fn), removeEventListener: (_, fn) => changes.delete(fn) };
  const doc = { body: { classList: { contains: () => false } }, getElementById: id => nodes.get(id),
    addEventListener: (_, fn) => listeners.set('click', fn), removeEventListener: () => listeners.delete('click') };
  const emit = button => listeners.get('click')?.({ target: { closest: () => button } });
  for (const id of ['data-panel', 'scene-panel', 'pp-toggles', 'cctv-panel', 'global-context-panel']) {
    const panel = { collapsed: true, clicks: 0, classList: { contains: () => panel.collapsed } };
    const button = { dataset: { collapseTarget: id }, click() { emit(button); panel.clicks++; panel.collapsed = !panel.collapsed; } };
    panel.querySelector = () => button; nodes.set(id, panel);
  }
  const world = { hidden: true, querySelector: () => ({ click: () => { world.hidden = true; } }) };
  nodes.set('world-connect-panel', world);
  return { doc, media, changes, listeners, nodes, world, emit };
}

test('mobile panel switching uses native controls and leaves only the selected panel open', () => {
  const f = fixture(); const destroy = initCompactPanels(f.doc, f.media);
  f.nodes.get('data-panel').querySelector().click();
  f.nodes.get('cctv-panel').querySelector().click();
  assert.equal(f.nodes.get('data-panel').collapsed, true);
  assert.equal(f.nodes.get('data-panel').clicks, 2);
  assert.equal(f.nodes.get('cctv-panel').collapsed, false);
  destroy(); assert.equal(f.listeners.size, 0); assert.equal(f.changes.size, 0);
});

test('World Connect and mobile panels do not remain open over each other', () => {
  const f = fixture(); initCompactPanels(f.doc, f.media);
  f.nodes.get('data-panel').querySelector().click();
  f.emit({ id: 'world-connect-toggle' }); f.world.hidden = false;
  assert.equal(f.nodes.get('data-panel').collapsed, true);
  f.nodes.get('scene-panel').querySelector().click();
  assert.equal(f.world.hidden, true);
});

test('desktop state and multiple open panels are untouched', () => {
  const f = fixture(false); initCompactPanels(f.doc, f.media);
  f.nodes.get('data-panel').querySelector().click();
  f.nodes.get('cctv-panel').querySelector().click();
  assert.equal(f.nodes.get('data-panel').collapsed, false);
  assert.equal(f.nodes.get('cctv-panel').collapsed, false);
});

test('rotation into a compact viewport normalizes restored expanded panels', () => {
  const f = fixture(false); initCompactPanels(f.doc, f.media);
  f.nodes.get('data-panel').collapsed = false; f.nodes.get('cctv-panel').collapsed = false;
  f.media.matches = true; for (const changed of f.changes) changed();
  assert.equal(f.nodes.get('data-panel').collapsed, false);
  assert.equal(f.nodes.get('cctv-panel').collapsed, true);
});
