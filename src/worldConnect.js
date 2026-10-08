import * as Cesium from 'cesium';
import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import { Network, X, ArrowUpRight } from 'lucide-react';
import './worldConnect.css';
import { accountProfile, rankNews } from './plasmaAccount.js';
import { newsBrief, newsMatches } from './newsContext.js';
import { sourceCard } from './spatial/sourceCard.js';

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
  let controller = null, current = null, version = 0, activeTab = 'economy', profile = null, mapTerms = [], selectedLocation = null, satelliteView = null;
  accountProfile().then(value => { profile = value; }).catch(() => {});
  const profileHandler = event => { profile = event.detail; if (!panel.hidden && activeTab === 'economy') showFeed('economy'); };
  window.addEventListener('plasma:profile', profileHandler);
  const locationHandler = event => { mapTerms = [event.detail?.query, ...(event.detail?.name || '').split(/[,\s]+/)].filter(Boolean).slice(0, 12);
    if (Number.isFinite(event.detail?.lat) && Number.isFinite(event.detail?.lon)) selectedLocation = event.detail; };
  window.addEventListener('plasma:location', locationHandler);
  const cancel = () => { satelliteView?.destroy(); satelliteView = null; controller?.abort(); controller = new AbortController(); return ++version; };
  close.onclick = () => { panel.hidden = true; cancel(); };
  async function get(path, options) {
    const response = await fetch(path, { ...options, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) }); const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`); return data;
  }
  function openNews(article) {
    const generation = cancel(); content.replaceChildren(tabs()); cleanupIcons();
    const back = text('button', '뉴스 목록', 'wc-back'); back.onclick = () => showFeed('economy'); content.append(back);
    const brief = article.brief || newsBrief(article);
    content.append(text('span', '출처 기반 브리핑 · 제목 확인 범위', 'wc-state'), text('h3', article.title),
      text('p', brief.text), text('p', brief.assessment), text('p', brief.scope, 'wc-muted'),
      text('p', `${article.provider} · ${new Date(article.publishedAt).toLocaleString('ko-KR')}`),
      text('p', article.recommendationReason), text('p', article.evidence, 'wc-muted'),
      sourceLink({ title: '원문 출처 (선택)', url: article.url }));
    content.append(sourceCard(article));
    const form = document.createElement('form'); form.className = 'wc-question';
    const input = document.createElement('input'); input.required = true; input.maxLength = 1000; input.placeholder = '이 뉴스의 출처·시각·내용 질문'; input.setAttribute('aria-label', '뉴스 질문');
    const send = document.createElement('button'); send.type = 'submit'; send.title = '질문 보내기'; send.setAttribute('aria-label', '질문 보내기'); icon(send, ArrowUpRight);
    const answer = text('p', '', 'wc-answer'); answer.setAttribute('aria-live', 'polite'); form.append(input, send); content.append(text('h3', '뉴스 질문'), form, answer);
    form.onsubmit = async event => {
      event.preventDefault(); if (send.disabled) return; send.disabled = true; answer.textContent = '출처 확인 중…';
      try {
        const result = await get('/api/world-connect/news-question', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: article.id, question: input.value }) });
        if (generation === version) answer.textContent = `${result.provider} · 출처 기록 응답 (생성형 AI 아님)\n${result.text}`;
      } catch (error) { if (generation === version) answer.textContent = error.message; }
      finally { send.disabled = false; }
    };
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
      content.append(sourceCard(current));
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
    for (const [id, label] of [['economy', '경제 뉴스'], ['events', '재난 사건'], ['satellite', '위성영상']]) {
      const b = text('button', label); b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(activeTab === id)); b.dataset.wcTab = id; b.onclick = () => showFeed(id); row.append(b);
    } return row;
  }
  async function showFeed(tab = activeTab, initialQuery = '') {
    activeTab = tab;
    const generation = cancel(); panel.hidden = false; content.replaceChildren(tabs(), text('p', tab === 'economy' ? '경제 뉴스 조회 중…' : 'USGS 최근 사건 조회 중…')); cleanupIcons();
    try {
      if (tab === 'satellite') {
        const { satellitePanel } = await import('./satelliteExplorer/panel.js'); if (generation !== version) return;
        content.replaceChildren(tabs());
        satelliteView = satellitePanel({ container: content, viewer, selectedLocation, initialQuery,
          onResolveLocation: async query => {
            const result = await window.__godsEyeView?.workspace?.search(query);
            if (!result || result.cancelled || generation !== version) return null;
            return selectedLocation;
          } }); return;
      }
      if (tab === 'economy') {
        const data = await get('/api/world-connect/news'); if (generation !== version) return;
        content.replaceChildren(tabs(), text('h3', profile?.personalization_consent ? '관심 뉴스' : '최근 경제 뉴스'), text('p', '공식 RSS · 단일 매체 · 독립 사실 검증 전', 'wc-state'));
        if (mapTerms.length) content.append(text('p', `최근 검색 지역: ${mapTerms[0]} · 제목에 지역명이 있을 때만 연결`, 'wc-muted'));
        const ranked = rankNews(data.articles, profile).map(article => {
          const matched = newsMatches(article, { mapTerms });
          return { ...article, score: article.score + matched.map.length * 2,
            recommendationReason: `${article.recommendationReason}${matched.map.length ? ` · 검색 지역명과 제목 일치: ${matched.map.join(', ')}` : ''}` };
        }).sort((a, b) => b.score - a.score || b.publishedAt - a.publishedAt);
        for (const article of ranked) {
          const row = document.createElement('section'); row.className = 'wc-news';
          const headline = text('button', article.title, 'wc-headline'); headline.onclick = () => openNews(article);
          row.append(headline, text('small', `${article.provider} · ${new Date(article.publishedAt).toLocaleString('ko-KR')}`),
            text('p', article.recommendationReason), text('p', article.evidence, 'wc-muted'), text('p', article.limitations, 'wc-muted'));
          content.append(row);
        }
        if (!data.articles.length) content.append(text('p', '최신 경제 뉴스가 없습니다.'));
        return;
      }
      const data = await get('/api/world-connect/events'); if (generation !== version) return;
      content.replaceChildren(tabs(), text('h3', '최근 24시간 · USGS'), text('p', '단일 출처 보고 · 독립 검증 전', 'wc-state'));
      for (const event of data.events) { const button = text('button', event.title, 'wc-event'); button.onclick = () => { navigate(event); open(event); }; content.append(button); }
      if (!data.events.length) content.append(text('p', '규모 2.5 이상 사건 없음'));
    } catch (error) { if (generation === version) content.replaceChildren(tabs(), text('p', error.message)); }
  }
  toggle.onclick = () => { if (!panel.hidden) close.click(); else showFeed(); };
  const intentHandler = event => { if (event.detail?.concept === 'satellite-imagery') showFeed('satellite', event.detail.location || ''); };
  window.addEventListener('plasma:spatial-intent', intentHandler);
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction(({ position }) => {
    const entity = viewer.scene.pick(position)?.id;
    if (typeof entity?.id !== 'string' || !entity.id.startsWith('earthquake:')) return;
    const p = entity.properties?.getValue(viewer.clock.currentTime); if (!p?.usgsId) return;
    open({ id: p.usgsId, title: `M${Number(p.mag).toFixed(1)} ${p.place}`, magnitude: p.mag, place: p.place,
      source: { title: 'USGS 사건 기록', url: `https://earthquake.usgs.gov/earthquakes/eventpage/${encodeURIComponent(p.usgsId)}` } });
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  return { open, destroy() { cancel(); window.removeEventListener('plasma:profile', profileHandler); window.removeEventListener('plasma:location', locationHandler); window.removeEventListener('plasma:spatial-intent', intentHandler); handler.destroy(); toggle.remove(); panel.remove(); cleanupIcons(); } };
}
