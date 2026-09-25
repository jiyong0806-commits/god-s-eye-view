import { governorRequestRender } from './renderGovernor.js';

export function initPlasmaControls() {
  const root = document.getElementById('plasma-grok-avatar');
  const stateLabel = root?.querySelector('.plasma-avatar-state');
  const caption = document.getElementById('plasma-voice-caption');
  const captionText = caption?.querySelector('p');
  const refresh = document.getElementById('refresh-map-data');

  const labels = { idle: '대기', listening: '듣는 중', heard: '인식됨', thinking: '생각 중', executing: '실행 중', done: '말하는 중', error: '오류' };
  let captionTimer = 0;
  const syncVoiceState = () => {
    const voice = document.getElementById('gev-voice-control');
    if (!root || !voice) return;
    const state = voice.dataset.status || 'idle';
    const detail = document.getElementById('gev-voice-detail')?.textContent?.trim() || '';
    root.dataset.state = state;
    if (stateLabel && stateLabel.textContent !== (labels[state] || state)) stateLabel.textContent = labels[state] || state;
    const shouldCaption = Boolean(detail) && ['heard', 'thinking', 'executing', 'done', 'error'].includes(state);
    if (caption && captionText && shouldCaption) {
      captionText.textContent = detail;
      caption.hidden = false;
      clearTimeout(captionTimer);
      if (state === 'done') captionTimer = window.setTimeout(() => { caption.hidden = true; }, 7000);
    } else if (caption && !['listening'].includes(state)) {
      caption.hidden = true;
    }
  };
  const attachVoiceObserver = () => {
    const voice = document.getElementById('gev-voice-control');
    if (!voice) return window.setTimeout(attachVoiceObserver, 150);
    const button = voice.querySelector('#gev-voice-button');
    const face = root?.querySelector('#plasma-voice-avatar');
    if (button && face && !button.contains(face)) {
      button.querySelector('.gev-mic-orbit')?.replaceWith(face);
      button.setAttribute('aria-label', 'Plasma 음성 명령');
      voice.parentElement?.appendChild(caption);
    }
    new MutationObserver(syncVoiceState).observe(voice, { attributes: true, childList: true, subtree: true, characterData: true });
    syncVoiceState();
  };
  attachVoiceObserver();

  refresh?.addEventListener('click', async () => {
    if (refresh.dataset.loading === 'true') return;
    refresh.dataset.loading = 'true';
    refresh.classList.add('is-refreshing');
    refresh.setAttribute('aria-label', '지도 데이터 업데이트 중');
    const app = window.__godsEyeView;
    try {
      const manager = app?.dataManager;
      const activeIds = manager
        ? [...manager.layers.entries()].filter(([, entry]) => entry.enabled).map(([id]) => id)
        : [];
      await Promise.allSettled(activeIds.map((id) => manager.refreshLayer(id)));
      app?.viewer?.scene?.imageryLayers?.raiseToTop?.(app.viewer.imageryLayers.get(app.viewer.imageryLayers.length - 1));
      governorRequestRender('manual-map-refresh');
      window.dispatchEvent(new CustomEvent('gev:map-refreshed', { detail: { activeIds } }));
      refresh.title = `${activeIds.length}개 활성 레이어 업데이트 완료`;
    } finally {
      refresh.dataset.loading = 'false';
      refresh.classList.remove('is-refreshing');
      refresh.setAttribute('aria-label', '지도와 활성 레이어 업데이트');
    }
  });
}
