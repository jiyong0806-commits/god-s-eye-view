export const SOUND_EVENTS = Object.freeze(['select', 'run', 'success', 'error', 'transition']);
const STORAGE_KEY = 'gev.sound.v1';
const NOTES = {
  select: [[680, 0, .07]],
  run: [[380, 0, .09], [570, .08, .12]],
  success: [[523, 0, .10], [659, .09, .10], [784, .18, .15]],
  error: [[260, 0, .12], [220, .13, .15]],
  transition: [[330, 0, .14], [495, .10, .18]],
};

// No polling or preloading. Audio is allocated only after a user enables it.
export function createSoundController({
  storage = globalThis.localStorage, document = globalThis.document,
  createContext = () => new (globalThis.AudioContext || globalThis.webkitAudioContext)(),
  createAudio = url => new Audio(url), now = () => Date.now(),
  schedule = setTimeout, cancel = clearTimeout, preview = false,
} = {}) {
  let settings = { enabled: false, volume: .18, source: 'synth' };
  try { const stored = JSON.parse(storage?.getItem(STORAGE_KEY) || 'null');
    if (stored) settings = { enabled: stored.enabled === true, volume: Number.isFinite(stored.volume) ? Math.max(0, Math.min(.5, stored.volume)) : .18,
      source: preview && stored.source === 'preview' ? 'preview' : 'synth' };
  } catch { /* Private browsing may disable storage. */ }
  let context, unlocked = false, disposed = false, suppressed = false, lastPlay = -Infinity, generation = 0;
  const active = new Set(), listeners = new Set();
  const snapshot = () => ({ ...settings, previewAvailable: preview });
  const emit = () => { for (const listener of listeners) listener(snapshot()); };
  const stop = () => { generation++; for (const release of [...active]) release(); };
  const save = () => { try { storage?.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {} emit(); };
  const unlock = () => {
    if (disposed) return;
    unlocked = true;
    if (settings.enabled && settings.source === 'synth') {
      try { context ||= createContext(); context.resume()?.catch(() => {}); } catch { unlocked = false; }
    }
  };
  const hidden = () => { if (document?.hidden) { stop(); context?.suspend()?.catch(() => {}); } };
  document?.addEventListener('visibilitychange', hidden);
  document?.addEventListener('pointerdown', unlock, { passive: true });
  document?.addEventListener('keydown', unlock);
  const allowed = () => !disposed && unlocked && settings.enabled && settings.volume > 0 && !suppressed && !document?.hidden;
  function play(kind) {
    if (!SOUND_EVENTS.includes(kind) || !allowed() || now() - lastPlay < 100) return false;
    lastPlay = now(); stop();
    const current = generation;
    if (preview && settings.source === 'preview') {
      const audio = createAudio(`/__sound-preview/${kind}.mp3`);
      audio.preload = 'none'; audio.volume = settings.volume;
      let timer;
      const release = () => { cancel(timer); audio.onended = audio.onerror = null; audio.pause(); audio.removeAttribute('src'); active.delete(release); };
      active.add(release); audio.onended = release;
      const fail = () => { release(); if (!disposed && current === generation) { settings.source = 'synth'; save(); } };
      audio.onerror = fail;
      // Long source clips cannot continue underneath voice or BGM.
      timer = schedule(release, kind === 'transition' ? 1400 : 1000);
      try { audio.play()?.catch(fail); } catch { fail(); return false; }
      return true;
    }
    try {
      context ||= createContext();
      const render = () => {
        if (current !== generation || !allowed() || context.state !== 'running') return;
        for (const [frequency, offset, duration] of NOTES[kind]) {
          const oscillator = context.createOscillator(), gain = context.createGain();
          const start = context.currentTime + offset;
          oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, start);
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(settings.volume * .22, start + .012);
          gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
          oscillator.connect(gain); gain.connect(context.destination);
          let released = false;
          const release = () => { if (released) return; released = true; oscillator.onended = null;
            try { oscillator.stop(); } catch {} oscillator.disconnect(); gain.disconnect(); active.delete(release); };
          active.add(release); oscillator.onended = release;
          oscillator.start(start); oscillator.stop(start + duration + .02);
        }
      };
      if (context.state === 'running') render(); else context.resume().then(render).catch(() => {});
      return true;
    } catch { return false; }
  }
  return {
    snapshot, play, stop, unlock,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    setEnabled(enabled) { settings.enabled = Boolean(enabled); if (!enabled) { stop(); context?.suspend()?.catch(() => {}); } else unlock(); save(); },
    setVolume(volume) { if (!Number.isFinite(Number(volume))) return; settings.volume = Math.max(0, Math.min(.5, Number(volume))); stop(); save(); },
    setSource(source) { settings.source = preview && source === 'preview' ? 'preview' : 'synth'; stop(); save(); },
    setSuppressed(value) { suppressed = Boolean(value); if (suppressed) stop(); },
    dispose() { if (disposed) return; disposed = true; stop(); context?.close()?.catch(() => {}); listeners.clear();
      document?.removeEventListener('visibilitychange', hidden); document?.removeEventListener('pointerdown', unlock); document?.removeEventListener('keydown', unlock); },
  };
}
