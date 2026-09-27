export function freshAlertRows(rows, seen, startedAt, now = Date.now()) {
  return rows.filter(row => !seen.has(row.id) && row.occurredAt >= startedAt && row.occurredAt <= now
    && now - row.occurredAt <= 180000);
}
export function initPlasmaAlerts({ notify }) {
  let on = false; try { on = localStorage.getItem('plasma:alerts') === '1'; } catch { /* storage unavailable */ }
  let startedAt = Date.now(), seen = new Set(), pending, disposed = false, lastError = 0;
  async function refresh() {
    if (pending) return pending;
    pending = (async () => {
      const r = await fetch('/api/alerts', { signal: AbortSignal.timeout(20000) }); const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      if (!Array.isArray(data.alerts)) throw new Error('경보 응답 형식 오류');
      if (!disposed && on) for (const row of freshAlertRows(data.alerts, seen, startedAt)) {
        notify(`${row.provider} 관측 · ${row.title} · ${new Date(row.occurredAt).toLocaleTimeString('ko-KR')}`);
        if (globalThis.Notification?.permission === 'granted') {
          const n = new Notification('PLASMA 지진 관측', { body: row.title, tag: row.id, icon: '/app-icon.png' });
          n.onclick = () => { window.focus(); window.__godsEyeView?.worldConnect?.open?.({ id: row.id.replace(/^usgs-/, ''), title: row.title }); n.close(); };
        }
      }
      seen = new Set(data.alerts.map(row => row.id)); return data;
    })().finally(() => { pending = null; }); return pending;
  }
  const poll = () => { if (!on || disposed || document.hidden) return;
    refresh().catch(error => { if (Date.now() - lastError > 300000) { lastError = Date.now(); notify(`재난 알림 연결 실패: ${error.message}`); } }); };
  const interval = setInterval(poll, 60000); document.addEventListener('visibilitychange', poll); if (on) poll();
  return { enabled: () => on, refresh, async toggle() {
    if (!on && globalThis.Notification?.permission === 'default') await Notification.requestPermission();
    on = !on; startedAt = Date.now(); seen.clear(); try { localStorage.setItem('plasma:alerts', on ? '1' : '0'); } catch { /* no storage */ }
    notify(on ? `앱 내 알림 켜짐${globalThis.Notification?.permission === 'granted' ? ' · 브라우저 알림 허용' : ' · 브라우저 알림 미허용'}` : '알림 꺼짐'); if (on) poll();
  }, destroy() { disposed = true; clearInterval(interval); document.removeEventListener('visibilitychange', poll); } };
}
