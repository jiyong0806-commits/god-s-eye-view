// Original synthesized UI tones: uploaded commercial recordings are not redistributed.
export function initQuietSfx() {
  let context, on = true, last = 0;
  try { on = localStorage.getItem('plasma:sfx') !== '0'; } catch { /* default quiet tones */ }
  function play(kind = 'click') {
    if (!on || document.hidden || Date.now() - last < 100) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext; if (!AudioContext) return;
    last = Date.now(); context ||= new AudioContext(); context.resume().catch(() => {});
    const oscillator = context.createOscillator(), gain = context.createGain(); const t = context.currentTime;
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(kind === 'save' ? 740 : kind === 'navigate' ? 480 : 620, t);
    oscillator.frequency.exponentialRampToValueAtTime(kind === 'save' ? 1100 : 400, t + .08);
    gain.gain.setValueAtTime(.0001, t); gain.gain.exponentialRampToValueAtTime(.025, t + .008); gain.gain.exponentialRampToValueAtTime(.0001, t + .09);
    oscillator.connect(gain); gain.connect(context.destination); oscillator.start(t); oscillator.stop(t + .1);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  const listener = event => { const b = event.target.closest?.('button'); if (b && !b.disabled && b.id !== 'gev-voice-button') play(); };
  document.addEventListener('click', listener);
  return { play, enabled: () => on, setEnabled(value) { on = Boolean(value); try { localStorage.setItem('plasma:sfx', on ? '1' : '0'); } catch { /* storage unavailable */ } },
    destroy() { document.removeEventListener('click', listener); context?.close().catch(() => {}); } };
}
