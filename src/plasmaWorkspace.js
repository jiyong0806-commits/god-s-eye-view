import * as Cesium from 'cesium';
import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import { Search, UserRound, Bookmark, RefreshCw, Map as MapIcon, CloudRain, Bell, X, Trash2, ArrowUpRight, CircleHelp, Volume2, Ellipsis, Layers2, Link, Globe2, Workflow } from 'lucide-react';
import { searchAndFlyTo, searchPlaces, CANCELLED_SEARCH } from './locations.js';
import { searchPolicy } from './searchPolicy.js';
import { accountClient, accountUser, accountProfile, saveProfile, accountRedirect } from './plasmaAccount.js';
import { initPlasmaAlerts } from './plasmaAlerts.js';
import { initQuietSfx } from './quietSfx.js';
import './plasmaWorkspace.css';

const el = (tag, value) => { const n = document.createElement(tag); if (value) n.textContent = value; return n; };
const roots = new Map();
function button(title, Icon, action) {
  const b = el('button'); b.type = 'button'; b.title = title; b.setAttribute('aria-label', title);
  const mount = el('span'); b.append(mount); const root = createRoot(mount); roots.set(mount, root);
  root.render(createElement(Icon, { size: 18, strokeWidth: 1.5 })); b.onclick = action; return b;
}
const cleanup = () => { for (const [n, r] of roots) if (!n.isConnected) { r.unmount(); roots.delete(n); } };
export function validBookmark(row) { return typeof row?.name === 'string' && row.name.length > 0 && row.name.length <= 100
  && Number.isFinite(row.lat) && Math.abs(row.lat) <= 90 && Number.isFinite(row.lon) && Math.abs(row.lon) <= 180
  && Number.isFinite(row.altitude) && row.altitude >= 20 && row.altitude <= 50000000; }

export function initPlasmaWorkspace(app) {
  const notice = el('div'); notice.id = 'plasma-notice'; notice.hidden = true; notice.setAttribute('role', 'status'); document.body.append(notice);
  let noticeTimer; const notify = message => { notice.textContent = message; notice.hidden = false; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { notice.hidden = true; }, 9000); };
  const dialog = el('dialog'); dialog.className = 'plasma-dialog'; document.body.append(dialog);
  const tools = el('div'); tools.className = 'plasma-tools'; tools.setAttribute('aria-label', 'Plasma 지도 도구'); document.body.append(tools);
  const sfx = initQuietSfx(); const alerts = initPlasmaAlerts({ notify, viewer: app.viewer });
  let searchController, cancelSelection;
  dialog.addEventListener('close', () => { cancelSelection?.(); cancelSelection = null; });
  function open(title) {
    cancelSelection?.(); cancelSelection = null;
    dialog.replaceChildren(); cleanup(); const header = el('header'); header.append(el('h2', title), button('닫기', X, () => dialog.close()));
    const body = el('div'); body.className = 'pd-body'; dialog.append(header, body); if (!dialog.open) dialog.showModal(); return body;
  }
  function field(form, label, name, type = 'text', value = '') {
    const wrap = el('label', label), input = el('input'); input.name = name; input.type = type; input.value = value; input.maxLength = 160; wrap.append(input); form.append(wrap); return input;
  }
  function submit(form, title) { const b = el('button', title); b.type = 'submit'; form.append(b); return b; }
  async function showAccount(signUp = false) {
    const body = open('PLASMA 계정'); const logo = el('img'); logo.src = '/brand/plasma-logo.png'; logo.alt = 'PLASMA'; logo.className = 'pd-logo'; body.append(logo);
    const status = el('p', '계정 서버 확인 중…'); status.className = 'pd-status'; body.append(status);
    try {
      const user = await accountUser(); if (!body.isConnected) return;
      if (!user) {
        status.textContent = signUp ? '회원가입 · 이메일 인증 후 로그인' : '로그인';
        const form = el('form'); const email = field(form, '이메일', 'email', 'email'); email.required = true; email.autocomplete = 'email';
        const pass = field(form, '비밀번호', 'password', 'password'); pass.required = true; pass.minLength = 12; pass.maxLength = 128; pass.autocomplete = signUp ? 'new-password' : 'current-password';
        if (signUp) { const terms = el('label'); terms.className = 'pd-check'; const check = el('input'); check.type = 'checkbox'; check.required = true;
          terms.append(check, el('span', '만 14세 이상이며 계정 생성에 동의합니다.')); form.append(terms); }
        const send = submit(form, signUp ? '회원가입' : '로그인'); body.append(form);
        const mode = el('button', signUp ? '로그인으로' : '회원가입'); mode.onclick = () => showAccount(!signUp); body.append(mode);
        form.onsubmit = async event => { event.preventDefault(); if (send.disabled) return; send.disabled = true;
          try { const c = await accountClient(); const result = signUp ? await c.auth.signUp({ email: email.value, password: pass.value,
            options: { emailRedirectTo: accountRedirect() } }) : await c.auth.signInWithPassword({ email: email.value, password: pass.value });
            if (result.error) throw result.error; pass.value = '';
            if (result.data.session) { await showAccount(); notify('로그인되었습니다.'); }
            else status.textContent = '인증 이메일을 확인하세요. 메일이 오지 않으면 메일 발송 설정 확인이 필요합니다.';
          } catch (error) { status.textContent = error.message; } finally { send.disabled = false; } };
        return;
      }
      status.textContent = user.email; const profile = await accountProfile() || {}; if (!body.isConnected) return;
      body.append(el('h3', '웰컴 맞춤 뉴스'), el('p', '설문은 선택입니다. 정확한 주소·생년월일·소득 금액은 받지 않습니다. 동의를 끄고 저장하면 설문 정보를 지웁니다.'));
      const form = el('form'); const occupation = field(form, '직업 (선택)', 'occupation', 'text', profile.occupation);
      const hobbies = field(form, '취미 (선택)', 'hobbies', 'text', profile.hobbies);
      const income = field(form, '돈벌이 수단 · 분야 (선택)', 'income', 'text', profile.income_source);
      const region = field(form, '거주 시·도 (선택)', 'region', 'text', profile.region);
      const topics = field(form, '관심 뉴스 · 쉼표로 구분 (선택)', 'topics', 'text', (profile.interests || []).join(', '));
      const ageLabel = el('label', '연령대 (선택)'), age = el('select');
      for (const value of ['', '14-19', '20-29', '30-49', '50+']) { const option = el('option', value || '선택 안 함'); option.value = value; age.append(option); }
      age.value = profile.age_band || ''; ageLabel.append(age); form.append(ageLabel);
      const consentLabel = el('label'); consentLabel.className = 'pd-check'; const consent = el('input'); consent.type = 'checkbox'; consent.checked = Boolean(profile.personalization_consent);
      consentLabel.append(consent, el('span', '설문 정보를 저장해 맞춤 뉴스에 사용하는 데 동의합니다.')); form.append(consentLabel);
      const send = submit(form, '설정 저장'); body.append(form);
      form.onsubmit = async event => { event.preventDefault(); send.disabled = true;
        try { await saveProfile({ occupation: occupation.value, hobbies: hobbies.value, income_source: income.value, region: region.value,
          age_band: age.value, interests: topics.value.split(',').map(x => x.trim()).filter(Boolean), personalization_consent: consent.checked });
          status.textContent = '설정 저장됨 · World Connect 경제 탭에서 확인하세요.';
        } catch (error) { status.textContent = error.message; } finally { send.disabled = false; } };
      const out = el('button', '로그아웃'); out.onclick = async () => { const { error } = await (await accountClient()).auth.signOut(); if (error) status.textContent = error.message;
        else { window.dispatchEvent(new CustomEvent('plasma:profile', { detail: null })); showAccount(); } }; body.append(out);
    } catch (error) { status.textContent = error.message; }
  }
  async function bookmarkStore() {
    const user = await accountUser().catch(() => null);
    if (user) { const c = await accountClient(); const { data, error } = await c.from('plasma_bookmarks').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100);
      if (error) throw error; return { rows: data.filter(validBookmark), user, c }; }
    let rows = []; try { rows = JSON.parse(localStorage.getItem('plasma:bookmarks') || '[]'); } catch { /* ignore damaged local data */ }
    return { rows: Array.isArray(rows) ? rows.filter(validBookmark).slice(0, 100) : [], user: null };
  }
  async function showBookmarks() {
    const body = open('찜한 위치'); const status = el('p', '조회 중…'); status.className = 'pd-status'; body.append(status);
    try { const store = await bookmarkStore(); if (!body.isConnected) return;
      status.textContent = store.user ? '계정에 저장된 위치' : '이 브라우저에 저장된 위치 · 로그인하면 계정 저장을 사용합니다.';
      const form = el('form'); const name = field(form, '현재 위치 이름', 'name'); name.required = true; name.maxLength = 100; const save = submit(form, '현재 위치 찜'); body.append(form);
      form.onsubmit = async event => { event.preventDefault(); if (save.disabled) return; save.disabled = true;
        try { if (store.rows.length >= 100) throw new Error('찜은 최대 100개입니다. 기존 위치를 지우세요.');
          const p = app.viewer.camera.positionCartographic;
          const row = { id: crypto.randomUUID(), name: name.value.trim(), lat: Cesium.Math.toDegrees(p.latitude), lon: Cesium.Math.toDegrees(p.longitude), altitude: Math.max(20, Math.min(50000000, p.height)) };
          if (!validBookmark(row)) throw new Error('위치 형식 오류');
          if (store.user) { const { error } = await store.c.from('plasma_bookmarks').insert({ ...row, user_id: store.user.id }); if (error) throw error; }
          else localStorage.setItem('plasma:bookmarks', JSON.stringify([row, ...store.rows])); await showBookmarks(); sfx.play('save');
        } catch (error) { status.textContent = error.message; save.disabled = false; } };
      for (const row of store.rows) { const line = el('div'); line.className = 'pd-row'; line.append(el('span', row.name),
        button('찜 위치로 이동', ArrowUpRight, () => { app.viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(row.lon, row.lat, row.altitude), duration: .6 }); dialog.close(); }),
        button('찜 삭제', Trash2, async () => { try { if (store.user) { const { error } = await store.c.from('plasma_bookmarks').delete().eq('id', row.id).eq('user_id', store.user.id); if (error) throw error; }
          else localStorage.setItem('plasma:bookmarks', JSON.stringify(store.rows.filter(x => x.id !== row.id))); await showBookmarks(); } catch (error) { status.textContent = error.message; } })); body.append(line); }
    } catch (error) { status.textContent = error.message; }
  }
  const search = el('form'), input = el('input'); input.placeholder = '시·도·지역·학교 검색'; input.required = true; input.maxLength = 160; input.setAttribute('aria-label', '한국어·전세계 위치 검색');
  const go = button('위치 검색', Search); go.type = 'submit'; search.append(input, go); tools.append(search);
  async function chooseSearchResult(query, candidates, policy = searchPolicy(query)) {
    const body = open(`검색 결과 · ${candidates.length}개`);
    if (policy.warning) { const warning = el('p', policy.warning); warning.className = 'pd-search-warning'; warning.setAttribute('role', 'status'); body.append(warning); }
    const list = el('ul'); list.className = 'pd-search-results'; body.append(list);
    return new Promise(resolve => {
      cancelSelection = () => resolve(null);
      for (const candidate of candidates) {
        const row = el('li'), pick = el('button'); pick.type = 'button';
        const name = candidate.name || candidate.formatted_address?.split(',')[0] || query;
        pick.append(el('strong', name), el('span', candidate.formatted_address || name));
        const point = candidate.geometry.location;
        pick.append(el('small', `${candidate.source || '지도 검색 공급자'} · ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`));
        pick.onclick = () => { cancelSelection = null; resolve(candidate); dialog.close(); };
        row.append(pick); list.append(row);
      }
      list.addEventListener('keydown', event => {
        if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
        event.preventDefault(); const buttons = [...list.querySelectorAll('button')];
        const next = buttons.indexOf(document.activeElement) + (event.key === 'ArrowDown' ? 1 : -1);
        buttons[(next + buttons.length) % buttons.length].focus();
      });
      list.querySelector('button')?.focus();
    });
  }
  async function searchLocation(query, options = {}) {
    searchController?.abort(); cancelSelection?.();
    const controller = new AbortController(); searchController = controller;
    const generation = options.beforeFly ? null : app.styleManager?._beginDeferredNavigation?.('location');
    if (generation === false) return CANCELLED_SEARCH;
    const beforeFly = options.beforeFly || (generation == null ? undefined : () => app.styleManager._reassertNavigationHandoff(generation));
    const candidates = await searchPlaces(app.viewer, query, { signal: controller.signal });
    if (controller.signal.aborted) return CANCELLED_SEARCH;
    const policy = searchPolicy(query);
    if (!candidates.length) {
      if (policy.warning) notify(`${policy.warning.split(' 아래는')[0]} 확인된 장소 검색 결과가 없습니다.`);
      return null;
    }
    const result = candidates.length > 1 || policy.requireSelection ? await chooseSearchResult(query, candidates, policy) : candidates[0];
    if (!result || controller.signal.aborted) return CANCELLED_SEARCH;
    const destination = await searchAndFlyTo(app.viewer, query, { ...options, beforeFly, result, resolveBuilding: false, duration: .6 });
    if (destination) window.dispatchEvent(new CustomEvent('plasma:location', { detail: { name: result.name || result.formatted_address || query, query,
      lat: result.geometry?.location?.lat, lon: result.geometry?.location?.lng } }));
    if (destination && !destination.cancelled) { app.requestRender('search-selection'); sfx.play('navigate'); }
    return destination;
  }
  search.onsubmit = async e => { e.preventDefault(); if (go.disabled) return; go.disabled = true;
    try { const query = input.value.trim(); const { parseSpatialIntent } = await import('./spatial/intent.js'); const intent = parseSpatialIntent(query);
      if (intent?.concept === 'satellite-imagery') { window.dispatchEvent(new CustomEvent('plasma:spatial-intent', { detail: intent })); return; }
      const result = await searchLocation(query); if (!result && !searchPolicy(query).warning) throw new Error('검색 결과가 없습니다. 지역명과 함께 검색하세요.'); }
    catch (error) { if (error.name !== 'AbortError') notify(error.message); } finally { go.disabled = false; } };
  const actionRail = document.getElementById('top-center-actions');
  actionRail?.querySelector('a')?.remove();
  for (const [id, Icon] of [['refresh-map-data', RefreshCw], ['clear-selected-layers', Layers2], ['share-btn', Link], ['reset-globe-view', Globe2]]) {
    const target = document.getElementById(id); if (!target) continue;
    const mount = el('span'); target.replaceChildren(mount); const root = createRoot(mount); roots.set(mount, root);
    root.render(createElement(Icon, { size: 20, strokeWidth: 1.5 }));
  }
  const accountButton = button('PLASMA 계정 설정', UserRound, () => showAccount()); accountButton.id = 'plasma-account-action'; actionRail?.append(accountButton);
  tools.append(button('찜한 위치', Bookmark, showBookmarks));
  const extra = el('div'); extra.className = 'plasma-extra-tools'; tools.append(extra);
  const map = button('OSM 2D / 3D 지도', MapIcon, async () => { if (map.disabled) return; map.disabled = true;
    try { const two = app.viewer.scene.mode !== Cesium.SceneMode.SCENE2D; await app.mapStackController.setStack(two ? 'osm' : 'esri-imagery');
      if (app.mapStackController.getState().activeId !== (two ? 'osm' : 'esri-imagery')) throw new Error('지도 공급원 전환 실패');
      if (two) app.viewer.scene.morphTo2D(0); else app.viewer.scene.morphTo3D(0); map.setAttribute('aria-pressed', String(two)); app.requestRender('map-mode'); sfx.play('navigate');
    } catch (error) { notify(error.message); } finally { map.disabled = false; } }); tools.append(map);
  const radar = button('날씨 레이더 모드', CloudRain, async () => { if (radar.disabled) return; radar.disabled = true;
    try { await app.dataManager.toggle('weather-radar'); const entry = app.dataManager.layers.get('weather-radar'); radar.setAttribute('aria-pressed', String(entry.enabled));
      if (!entry.enabled || entry.module.getStats().error) notify(entry.module.getStats().error || '레이더 연결 실패');
    } catch (error) { notify(error.message); } finally { radar.disabled = false; } }); extra.append(radar);
  const bell = button('재난 알림 설정', Bell, async () => { const body = open('재난 관측 알림'); body.append(el('p', '페이지가 열려 있는 동안 새로 수신한 사건을 알립니다. 국가 재난문자·조기경보가 아닙니다. 닫힌 앱의 푸시는 아직 지원하지 않습니다.'));
    const enabled = el('button', alerts.enabled() ? '알림 끄기' : '알림 켜기'); enabled.onclick = async () => { await alerts.toggle(); enabled.textContent = alerts.enabled() ? '알림 끄기' : '알림 켜기'; bell.setAttribute('aria-pressed', String(alerts.enabled())); }; body.append(enabled);
    const status = el('p', '출처 확인 중…'); body.append(status); try { const data = await alerts.refresh(); if (!body.isConnected) return; status.textContent = data.domestic.error;
      for (const row of data.alerts.slice(0, 10)) { const link = el('a', `${row.title} · ${new Date(row.occurredAt).toLocaleString('ko-KR')}`); link.href = row.sourceUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; const line = el('p'); line.append(link); body.append(line); }
    } catch (error) { status.textContent = error.message; } }); extra.append(bell);
  extra.append(button('효과음 설정', Volume2, () => { const body = open('효과음'); const label = el('label'); label.className = 'pd-check'; const check = el('input'); check.type = 'checkbox'; check.checked = sfx.enabled();
    check.onchange = () => { sfx.setEnabled(check.checked); if (check.checked) sfx.play('save'); }; label.append(check, el('span', '작은 효과음')); body.append(label); }));
  const steps = [ ['위치 검색', '시·도나 학교 이름을 검색하면 좌표가 확인된 장소로 이동합니다.'], ['실시간 레이어', '데이터 레이어에서 선박·항공기·CCTV를 켭니다. 제한·재시도 상태는 실제 공급자 응답입니다.'],
    ['지도 모드와 찜', 'OSM 2D와 3D를 전환하고 현재 위치를 찜한 뒤 바로 이동할 수 있습니다.'], ['World Connect', '경제 탭에서 공식 RSS 뉴스와 원본 출처를 확인합니다. 계정 설정의 선택 설문으로 관련 제목을 먼저 표시합니다.'],
    ['음성과 경보', '마이크는 브라우저 한국어 인식입니다. 로컬 실행에서는 Ollama가 명령을 해석합니다. 재난 알림은 직접 켜야 합니다.'] ];
  extra.append(button('튜토리얼', CircleHelp, () => { let index = 0; const render = () => { const body = open(`튜토리얼 ${index + 1} / ${steps.length}`); body.append(el('h3', steps[index][0]), el('p', steps[index][1]));
    const next = el('button', index === steps.length - 1 ? '완료' : '다음'); next.onclick = () => { if (index === steps.length - 1) dialog.close(); else { index++; render(); } }; body.append(next); }; render(); }));
  extra.append(button('God Flow', Workflow, () => { location.assign('/home/'); }));
  const more = button('추가 지도 도구', Ellipsis, () => { const expanded = tools.classList.toggle('tools-expanded'); more.setAttribute('aria-expanded', String(expanded)); });
  more.className = 'plasma-more'; more.setAttribute('aria-expanded', 'false'); tools.append(more);
  return { notify, showAccount, showBookmarks, search: searchLocation, destroy() { searchController?.abort(); cancelSelection?.(); accountButton.remove(); alerts.destroy(); sfx.destroy(); tools.remove(); dialog.remove(); notice.remove(); clearTimeout(noticeTimer); cleanup(); } };
}
