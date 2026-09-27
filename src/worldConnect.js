import * as Cesium from 'cesium';
import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import { Network, X, ArrowUpRight } from 'lucide-react';
import './worldConnect.css';
import { accountProfile, rankNews } from './plasmaAccount.js';

const iconRoots = new Map();
function cleanupIcons() {
  for (const [mount, root] of iconRoots) if (!mount.isConnected) { root.unmount(); iconRoots.delete(mount); }
}
function icon(button, component) {
  const mount = document.createElement('span'); button.append(mount);
  const root = createRoot(mount); iconRoots.set(mount, root);
  root.render(createElement(component, { size: 18, strokeWidth: 1.5, 'aria-hidden': true }));
}
function text(tag, value, className) { const node = document.createElement(tag); node.textContent = value; if (className) node.className = className; return node; }
function sourceLink(source) {
  const link = text('a', source.title); link.href = source.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; return link;
}

export function initWorldConnect(viewer) {
  const toggle = document.createElement('button'); toggle.id = 'world-connect-toggle'; toggle.title = 'World Connect'; toggle.setAttribute('aria-label', 'World Connect 사건 열기'); icon(toggle, Network);
  const panel = document.createElement('aside'); panel.id = 'world-connect-panel'; panel.hidden = true; panel.setAttribute('aria-label', 'World Connect');
  const header = document.createElement('header'); header.append(text('h2', 'World Connect'));
  const close = document.createElement('button'); close.title = '닫기'; close.setAttribute('aria-label', '닫기'); icon(close, X); header.append(close);
  const content = document.createElement('div'); content.className = 'wc-content'; panel.append(header, content); document.body.append(toggle, panel);
  let controller = null, current = null, version = 0, activeTab = 'economy', profile = null;
  accountProfile().then(value => { profile = value; }).catch(() => {});
  window.addEventListener('plasma:profile', event => { profile = event.detail; if (!panel.hidden && activeTab === 'economy') showFeed('economy'); });
  const cancel = () => { controller?.abort(); controller = new AbortController(); return ++version; };
  close.onclick = () => { panel.hidden = true; cancel(); };
  async function get(path, options) {
    const response = await fetch(path, { ...options, signal: controller.signal }); const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`); return data;
  }
  function navigate(event) { viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(event.lon, event.lat, 1200000), duration: 0.8 }); }
  async function open(event) {
    const generation = cancel(); current = event; panel.hidden = false; content.replaceChildren(); cleanupIcons();
    content.append(text('span', '단일 출처 보고 · 독립 검증 전', 'wc-state'), text('h3', event.title), text('p', event.summary || `${event.place} · M${event.magnitude}`));
    if (event.source) content.append(sourceLink(event.source));
    const status = text('p', '관련 사건 조회 중…', 'wc-muted'); content.append(status);
    try {
      const data = await get(`/api/world-connect/analyze?id=${encodeURIComponent(event.id)}`);
      if (generation !== version) return;
      current = data.event; status.textContent = data.limitations;
      content.append(text('h3', '연결 관계 · 깊이 1'));
      const graph = document.createElement('div'); graph.className = 'wc-graph'; graph.append(text('div', current.title, 'wc-center'));
      if (!data.relations.length) graph.append(text('p', '500km · 24시간 범위의 관련 기록 없음', 'wc-muted'));
      for (const relation of data.relations) {
        const row = document.createElement('section'); row.className = 'wc-relation';
        const button = text('button', relation.event.title); icon(button, ArrowUpRight);
        button.onclick = () => { navigate(relation.event); open(relation.event); };
        row.append(text('small', 'LOCATION · 공간·시간 인접'), button, text('p', relation.reason), sourceLink(relation.event.source)); graph.append(row);
      }
      content.append(graph);
      const form = document.createElement('form'); form.className = 'wc-question';
      const input = document.createElement('input'); input.placeholder = '이 사건에 대해 질문'; input.maxLength = 1000; input.required = true; input.setAttribute('aria-label', '사건 질문');
      const send = document.createElement('button'); send.type = 'submit'; send.title = '질문 보내기'; send.setAttribute('aria-label', '질문 보내기'); icon(send, ArrowUpRight);
      const answer = text('p', '', 'wc-answer'); form.append(input, send); content.append(text('h3', '사건 질문'), form, answer);
      form.onsubmit = async e => {
        e.preventDefault(); if (send.disabled) return; send.disabled = true; answer.textContent = '응답 대기 중…';
        try {
          const result = await get('/api/world-connect/question', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: current.id, question: input.value }) });
          if (generation === version) {
            const label = result.mode === 'grounded-answer' ? '근거 응답 · AI 질문 해석'
              : result.mode === 'source-lookup' ? '출처 기록 조회 · AI 아님' : '원본 요약 · AI 응답 제외';
            answer.textContent = `${label} · ${result.provider}\n${result.text}${result.ai ? `\nAI 상태: ${result.ai.reason} (${result.ai.httpStatus})` : ''}`;
          }
        } catch (error) { if (generation === version) answer.textContent = error.message; }
        finally { send.disabled = false; }
      };
    } catch (error) { if (generation === version) status.textContent = `${error.message} · 재시도하려면 사건을 다시 선택하세요.`; }
  }
  function tabs() {
    const row = document.createElement('div'); row.className = 'wc-tabs'; row.setAttribute('role', 'tablist');
    for (const [id, label] of [['economy', '경제 뉴스'], ['events', '재난 사건']]) {
      const b = text('button', label); b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(activeTab === id)); b.dataset.wcTab = id; b.onclick = () => showFeed(id); row.append(b);
    } return row;
  }
  async function showFeed(tab = activeTab) {
    activeTab = tab;
    const generation = cancel(); panel.hidden = false; content.replaceChildren(tabs(), text('p', tab === 'economy' ? '경제 뉴스 조회 중…' : 'USGS 최근 사건 조회 중…')); cleanupIcons();
    try {
      if (tab === 'economy') {
        const data = await get('/api/world-connect/news'); if (generation !== version) return;
        content.replaceChildren(tabs(), text('h3', profile?.personalization_consent ? '웰컴 맞춤 뉴스' : '최근 경제 뉴스'), text('p', '발행사 공식 RSS · 원문 출처', 'wc-state'));
        for (const article of rankNews(data.articles, profile)) {
          const row = document.createElement('section'); row.className = 'wc-news';
          const headline = text('a', article.title); headline.href = article.url; headline.target = '_blank'; headline.rel = 'noopener noreferrer';
          row.append(headline, text('small', `${article.provider} · ${new Date(article.publishedAt).toLocaleString('ko-KR')}`),
            text('p', article.recommendationReason), text('p', article.evidence, 'wc-muted'), text('p', article.limitations, 'wc-muted'));
          const photo = sourceLink({ title: '사진·기사 원문 확인', url: article.photoSourceUrl }); row.append(photo); content.append(row);
        }
        if (!data.articles.length) content.append(text('p', '최신 경제 뉴스가 없습니다.'));
        return;
      }
      const data = await get('/api/world-connect/events'); if (generation !== version) return;
      content.replaceChildren(tabs(), text('h3', '최근 24시간 · USGS'), text('p', '단일 출처 보고 · 독립 검증 전', 'wc-state'));
      for (const event of data.events) { const button = text('button', event.title, 'wc-event'); button.onclick = () => { navigate(event); open(event); }; content.append(button); }
      if (!data.events.length) content.append(text('p', '규모 2.5 이상 사건 없음'));
    } catch (error) { if (generation === version) content.replaceChildren(text('p', error.message)); }
  }
  toggle.onclick = () => { if (!panel.hidden) close.click(); else showFeed(); };
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction(({ position }) => {
    const entity = viewer.scene.pick(position)?.id;
    if (typeof entity?.id !== 'string' || !entity.id.startsWith('earthquake:')) return;
    const p = entity.properties?.getValue(viewer.clock.currentTime); if (!p?.usgsId) return;
    open({ id: p.usgsId, title: `M${Number(p.mag).toFixed(1)} ${p.place}`, magnitude: p.mag, place: p.place,
      source: { title: 'USGS 사건 기록', url: `https://earthquake.usgs.gov/earthquakes/eventpage/${encodeURIComponent(p.usgsId)}` } });
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  return { open, destroy() { cancel(); handler.destroy(); toggle.remove(); panel.remove(); cleanupIcons(); } };
}
