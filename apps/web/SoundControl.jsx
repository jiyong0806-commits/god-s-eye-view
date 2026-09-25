import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { IconButton } from '../../packages/god-ui/IconButton.jsx';

export function SoundControl({ controller }) {
  const [state, setState] = useState(controller.snapshot);
  const [open, setOpen] = useState(false);
  useEffect(() => controller.subscribe(setState), [controller]);
  return <div className="sound-control" onKeyDown={event => { if (event.key === 'Escape') setOpen(false); }}>
    <IconButton label="효과음 설정" aria-expanded={open} onClick={() => setOpen(!open)}>
      {state.enabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
    </IconButton>
    {open && <div className="sound-popover" role="group" aria-label="효과음 설정">
      <label><span>효과음</span><input type="checkbox" checked={state.enabled} onChange={event => {
        controller.setEnabled(event.target.checked); controller.play('select');
      }} /></label>
      <label htmlFor="sfx-volume"><span>음량</span><output>{Math.round(state.volume * 100)}%</output></label>
      <input id="sfx-volume" type="range" min="0" max="50" step="1" value={Math.round(state.volume * 100)}
        onChange={event => controller.setVolume(Number(event.target.value) / 100)} />
      {state.previewAvailable && <label className="sound-source">사운드 세트<select value={state.source} onChange={event => controller.setSource(event.target.value)}>
        <option value="synth">기본 효과음</option><option value="preview">제공 파일 · 로컬 미리듣기</option>
      </select></label>}
    </div>}
  </div>;
}
