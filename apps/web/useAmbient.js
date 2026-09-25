import { useEffect, useState } from 'react';
export function useMedia(query) {
  const [matches, setMatches] = useState(() => matchMedia(query).matches);
  useEffect(() => { const media = matchMedia(query); const update = () => setMatches(media.matches);
    media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, [query]);
  return matches;
}
export function useAmbient(ref) {
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let frame = 0, x = 50, y = 50;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const move = event => {
      if (document.hidden || reduced.matches || event.pointerType !== 'mouse') return;
      x = event.clientX / innerWidth * 100; y = event.clientY / innerHeight * 100;
      if (!frame) frame = requestAnimationFrame(() => { el.style.setProperty('--pointer-x', `${x}%`);
        el.style.setProperty('--pointer-y', `${y}%`); frame = 0; });
    };
    const visibility = () => { el.dataset.paused = String(document.hidden); if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } };
    window.addEventListener('pointermove', move, { passive: true }); document.addEventListener('visibilitychange', visibility);
    visibility();
    return () => { cancelAnimationFrame(frame); window.removeEventListener('pointermove', move); document.removeEventListener('visibilitychange', visibility); };
  }, [ref]);
}
