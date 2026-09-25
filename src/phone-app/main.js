import './style.css';

const layers = [
  ['✈', '항공·우주', '항공기 · 군용기 · 위성 · 우주 발사'],
  ['🚗', '교통·도시', '차량 · 사람 · 속도 카메라 · 지하철'],
  ['☔', '재난·환경', '날씨 레이더 · 화재 · 지진 · 안전도'],
  ['▣', '감시·안전', 'CCTV · 대피소 · 병원 · 군사 상황'],
  ['≋', '해양·인프라', '선박 · 해저 케이블 · 데이터센터 · 댐'],
  ['◉', '음성·라디오', '한국어 음성 명령 · 라디오 · 현장 상태'],
];

function phoneMarkup() {
  return `
    <main class="phone-shell" aria-label="GOD'S EYE VIEW phone app">
      <section class="phone-hero" aria-label="현재 지구 상황">
        <div class="phone-status">
          <span>GOD'S EYE</span>
          <span>PHONE APP</span>
        </div>

        <header class="phone-header">
          <img class="phone-icon" src="/app-icon.png" alt="" />
          <div>
            <p class="eyebrow">MOBILE COMMAND</p>
            <h1>지구를 손 안에</h1>
          </div>
          <button class="circle-btn" id="phone-refresh" type="button" aria-label="새로고침">↻</button>
        </header>

        <div class="globe-card" aria-hidden="true">
          <div class="globe-orbit orbit-one"></div>
          <div class="globe-orbit orbit-two"></div>
          <div class="globe">
            <div class="globe-light"></div>
            <div class="globe-lines"></div>
          </div>
          <div class="nav-cursor"></div>
        </div>

        <article class="signal-card">
          <span class="signal-row"><i></i> LIVE · SEOUL GRID</span>
          <strong id="phone-status">폰앱 모드 정상 실행</strong>
          <p>하얀 화면 방지용으로 CSS/JS를 번들에 묶은 별도 모바일 앱입니다.</p>
        </article>
      </section>

      <section class="action-grid" aria-label="빠른 실행">
        <button class="action-card primary" id="launch-globe" type="button">
          <span>⌖</span>
          <strong>3D 지구본</strong>
          <small>메인 지도 실행</small>
        </button>
        <button class="action-card" data-action="layers" type="button">
          <span>▦</span>
          <strong>레이어</strong>
          <small>기능별 분리</small>
        </button>
        <button class="action-card" data-action="voice" type="button">
          <span>◉</span>
          <strong>음성</strong>
          <small>한국어 명령</small>
        </button>
        <button class="action-card" data-action="connect" type="button">
          <span>⇄</span>
          <strong>PC 연결</strong>
          <small>같은 Wi-Fi</small>
        </button>
      </section>

      <section class="layer-sheet" aria-label="레이어">
        <div class="sheet-grip"></div>
        <div class="sheet-head">
          <div>
            <p class="eyebrow">LAYER STACK</p>
            <h2>기능 탭</h2>
          </div>
          <span>FREE SAFE</span>
        </div>
        <div class="layer-list" id="layer-list"></div>
      </section>

      <nav class="phone-nav" aria-label="하단 내비게이션">
        <button class="active" type="button" data-tab="home">⌂<span>홈</span></button>
        <button type="button" data-tab="layers">▦<span>레이어</span></button>
        <button type="button" data-tab="voice">◉<span>음성</span></button>
        <button type="button" data-tab="settings">⚙<span>설정</span></button>
      </nav>
    </main>
  `;
}

function setStatus(text) {
  const status = document.querySelector('#phone-status');
  if (status) status.textContent = text;
}

function renderLayers() {
  const list = document.querySelector('#layer-list');
  if (!list) return;
  for (const [icon, title, detail] of layers) {
    const item = document.createElement('article');
    item.className = 'layer-item';
    item.innerHTML = `
      <span class="layer-icon">${icon}</span>
      <span class="layer-copy">
        <strong>${title}</strong>
        <small>${detail}</small>
      </span>
      <button class="switch" type="button" aria-label="${title} 켜기" aria-pressed="false"></button>
    `;
    const sw = item.querySelector('.switch');
    sw.addEventListener('click', () => {
      const active = !sw.classList.contains('active');
      sw.classList.toggle('active', active);
      sw.setAttribute('aria-pressed', String(active));
      setStatus(`${title} ${active ? '켜짐' : '꺼짐'}`);
    });
    list.appendChild(item);
  }
}

function activateTab(tab) {
  for (const button of document.querySelectorAll('.phone-nav button')) {
    button.classList.toggle('active', button.dataset.tab === tab);
  }
  if (tab === 'layers') {
    document.querySelector('.layer-sheet')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setStatus('레이어 화면');
  } else if (tab === 'voice') {
    setStatus('브라우저 무료 음성 대기');
  } else if (tab === 'settings') {
    setStatus('무료 키 · 안전 설정');
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setStatus('폰앱 모드 정상 실행');
  }
}

document.querySelector('#phone-root').innerHTML = phoneMarkup();
renderLayers();

document.querySelector('#launch-globe')?.addEventListener('click', () => {
  const view = '#v=2&lat=37.5665&lon=126.9780&alt=2500&heading=20&pitch=-35&map=esri-imagery';
  window.location.assign(`${window.location.origin}/${view}`);
});

document.querySelector('#phone-refresh')?.addEventListener('click', () => setStatus('새로고침 완료'));

for (const button of document.querySelectorAll('[data-action]')) {
  button.addEventListener('click', () => {
    const action = button.dataset.action;
    if (action === 'layers') activateTab('layers');
    if (action === 'voice') activateTab('voice');
    if (action === 'connect') setStatus('같은 Wi-Fi에서 PC 연결 대기');
  });
}

for (const button of document.querySelectorAll('.phone-nav button')) {
  button.addEventListener('click', () => activateTab(button.dataset.tab));
}
