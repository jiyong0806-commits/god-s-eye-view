const TRACKS = ['/media/map-bgm.mp3', '/media/map-bgm-2.mp3'];

export function initPlasmaBgm() {
  if (typeof document === 'undefined') return null;
  const dock = document.getElementById('command-dock') || document.body;
  const root = document.createElement('div');
  root.id = 'plasma-bgm-control';
  root.innerHTML = `
    <button id="plasma-bgm-button" type="button" aria-pressed="false" title="배경음악 켜기/끄기">
      <span class="plasma-bgm-icon" aria-hidden="true">♪</span>
      <span class="plasma-bgm-label">BGM</span>
    </button>
  `;
  dock.appendChild(root);

  const audio = new Audio(TRACKS[0]);
  audio.preload = 'metadata';
  audio.loop = true;
  audio.volume = 0.32;
  audio.crossOrigin = 'anonymous';

  const button = root.querySelector('#plasma-bgm-button');
  const setPlaying = (playing) => {
    root.dataset.playing = playing ? 'true' : 'false';
    button?.setAttribute('aria-pressed', String(playing));
  };

  button?.addEventListener('click', async () => {
    try {
      if (!audio.paused) {
        audio.pause();
        setPlaying(false);
        return;
      }
      await audio.play();
      setPlaying(true);
    } catch (error) {
      console.warn('[Plasma BGM] playback failed:', error?.message || error);
      setPlaying(false);
    }
  });

  window.__plasmaBgm = { audio, tracks: [...TRACKS] };
  return window.__plasmaBgm;
}
