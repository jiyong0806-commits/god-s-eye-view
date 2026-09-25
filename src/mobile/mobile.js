const layers = [
  ['✈', '항공·우주', '실시간 항공기, 군용 항공기, 위성, 우주 발사'],
  ['🚗', '교통·도시', '차량·교통, 사람·유동인구, 속도 카메라'],
  ['☔', '재난·환경', '날씨 레이더, 화재·산불, 지진, 안전도'],
  ['▣', '감시·안전', 'CCTV, 대피소, 병원, 군사 상황'],
  ['≋', '해양·인프라', '선박, 해저 케이블, 데이터센터, 댐'],
  ['◉', '음성·라디오', '한국어 음성 명령, 라디오, 현장 상태'],
];

const status = document.querySelector('#mobile-status');
const layerList = document.querySelector('#mobile-layer-list');
const navButtons = [...document.querySelectorAll('.bottom-nav button')];

function setStatus(text) {
  if (!status) return;
  status.textContent = text;
}

function renderLayers() {
  if (!layerList) return;
  layerList.innerHTML = '';
  for (const [icon, title, detail] of layers) {
    const item = document.createElement('article');
    item.className = 'layer-item';
    item.innerHTML = `
      <span class="layer-icon" aria-hidden="true">${icon}</span>
      <span class="layer-copy">
        <strong>${title}</strong>
        <small>${detail}</small>
      </span>
      <button class="toggle" type="button" aria-label="${title} 켜기" aria-pressed="false"></button>
    `;
    const toggle = item.querySelector('.toggle');
    toggle.addEventListener('click', () => {
      const active = !toggle.classList.contains('active');
      toggle.classList.toggle('active', active);
      toggle.setAttribute('aria-pressed', String(active));
      toggle.setAttribute('aria-label', `${title} ${active ? '끄기' : '켜기'}`);
      setStatus(`${title} ${active ? '활성화' : '비활성화'}`);
    });
    layerList.appendChild(item);
  }
}

function setTab(tab) {
  for (const button of navButtons) {
    button.classList.toggle('active', button.dataset.tab === tab);
  }
  const sheet = document.querySelector('.mobile-sheet');
  if (tab === 'layers') {
    sheet?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setStatus('레이어 탭 열림');
  } else if (tab === 'voice') {
    setStatus('무료 브라우저 음성 명령 대기');
  } else if (tab === 'settings') {
    setStatus('설정은 안전 키와 무료 모드 중심');
  } else {
    setStatus('모바일 모드 준비');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

renderLayers();

document.querySelector('#open-3d')?.addEventListener('click', () => {
  const view = '#v=2&lat=37.5665&lon=126.9780&alt=2500&heading=20&pitch=-35&map=esri-imagery';
  window.location.assign(`${window.location.origin}/${view}`);
});

document.querySelector('#mobile-refresh')?.addEventListener('click', () => {
  setStatus('상태 새로고침 완료');
});

for (const button of document.querySelectorAll('[data-action]')) {
  button.addEventListener('click', () => {
    const action = button.dataset.action;
    if (action === 'layers') setTab('layers');
    if (action === 'voice') setTab('voice');
    if (action === 'connect') setStatus('PC 연결은 같은 Wi-Fi에서 준비 중');
  });
}

for (const button of navButtons) {
  button.addEventListener('click', () => setTab(button.dataset.tab));
}
