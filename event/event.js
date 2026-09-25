const search = document.getElementById('booth-search');
const list = document.getElementById('booth-list');
const pins = document.getElementById('map-pins');
const count = document.getElementById('booth-count');
let booths = [];

function selectBooth(booth) {
  for (const element of document.querySelectorAll('[data-booth-id]')) {
    element.classList.toggle('active', element.dataset.boothId === booth.id);
  }
  document.getElementById('booth-detail')?.remove();
  const detail = document.createElement('div');
  detail.id = 'booth-detail';
  detail.className = 'booth-detail';
  detail.textContent = `${booth.name} · ${booth.location || '위치 확인 중'}${booth.description ? ` — ${booth.description}` : ''}`;
  list.prepend(detail);
}

function renderBooths() {
  const query = search.value.trim().toLocaleLowerCase();
  const matches = booths.filter((booth) => `${booth.name} ${booth.topic || ''}`.toLocaleLowerCase().includes(query));
  count.textContent = `확인된 부스 ${matches.length}개`;
  list.replaceChildren();
  pins.replaceChildren();
  if (!matches.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = query ? '검색 결과가 없습니다.' : '공식 부스 배치도가 아직 등록되지 않았습니다. 프로젝트 소개는 위에서 확인할 수 있습니다.';
    list.append(empty);
    return;
  }
  for (const booth of matches) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'booth-item';
    item.dataset.boothId = booth.id;
    const title = document.createElement('strong');
    title.textContent = booth.name;
    const meta = document.createElement('small');
    meta.textContent = [booth.topic, booth.location].filter(Boolean).join(' · ');
    item.append(title, meta);
    item.addEventListener('click', () => selectBooth(booth));
    list.append(item);
    if (Number.isFinite(booth.x) && Number.isFinite(booth.y) && booth.x >= 0 && booth.x <= 100 && booth.y >= 0 && booth.y <= 100) {
      const pin = document.createElement('button');
      pin.type = 'button';
      pin.className = 'map-pin';
      pin.dataset.boothId = booth.id;
      pin.style.left = `${booth.x}%`;
      pin.style.top = `${booth.y}%`;
      pin.textContent = booth.number || booth.name;
      pin.title = booth.name;
      pin.addEventListener('click', () => selectBooth(booth));
      pins.append(pin);
    }
  }
}

search.addEventListener('input', renderBooths);
fetch('/event/booths.json', { cache: 'no-store' })
  .then((response) => { if (!response.ok) throw new Error('Booth data unavailable'); return response.json(); })
  .then((data) => { booths = Array.isArray(data.booths) ? data.booths : []; renderBooths(); })
  .catch(() => { booths = []; renderBooths(); });
