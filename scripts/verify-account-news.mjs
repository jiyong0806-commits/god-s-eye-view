import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer';
import sharp from 'sharp';

const base = process.argv[2] || 'http://127.0.0.1:5188';
mkdirSync('output/account-qa', { recursive: true });
const browser = await puppeteer.launch({ headless: true,
  executablePath: existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined,
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=d3d11'] });
const results = [];
const user = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'qa@example.test', user_metadata: {}, app_metadata: {}, created_at: new Date().toISOString() };
const token = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.qa-signature-not-a-real-session`;
try {
  for (const [width, height] of [[1440, 900], [393, 852]]) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage(); await page.setViewport({ width, height, deviceScaleFactor: 1 });
    const errors = [], resources = [];
    let permitLogin = false, verified = 0;
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => resources.push(request.url()));
    await page.setRequestInterception(true);
    page.on('request', async request => {
      const url = new URL(request.url());
      const answer = (body, status = 200) => request.respond({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, body: JSON.stringify(body) });
      if (url.hostname.endsWith('.supabase.co')) {
        if (request.method() === 'OPTIONS') return request.respond({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PUT,DELETE' } });
        if (url.pathname === '/auth/v1/token') return permitLogin ? answer({ access_token: token, refresh_token: 'qa-refresh-not-real', token_type: 'bearer', expires_in: 3600, user }) : answer({ code: 'invalid_credentials', msg: 'Invalid login credentials' }, 400);
        if (url.pathname === '/auth/v1/user') { verified++; return answer(user); }
        if (url.pathname === '/auth/v1/logout') return answer({});
        return answer(null);
      }
      if (url.pathname === '/api/geocode') return answer({ status: 'OK', results: [
        { name: '서울역 1', formatted_address: '서울역 1', geometry: { location: { lat: 37.5547, lng: 126.9707 } } },
        { name: '서울역 2', formatted_address: '서울역 2', geometry: { location: { lat: 37.55, lng: 126.98 } } },
      ] });
      return request.continue();
    });
    await page.goto(`${base}/map/#v=2&lat=37.5&lon=127&alt=18000000&pitch=-90&map=nasa-blue-marble&l=`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#account-form', { timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth > 0), { timeout: 15000 });
    assert.equal(await page.$('canvas'), null, 'anonymous map must not initialize');
    assert.equal(resources.some(url => url.endsWith('/cesium/Cesium.js')), false, 'login must not download the map engine');
    await page.screenshot({ path: `output/account-qa/login-${width}.png` });
    const login = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth,
      image: [...document.images].every(img => img.complete && img.naturalWidth > 0),
      font: document.fonts.check('16px Pretendard'), background: getComputedStyle(document.querySelector('.account-backdrop')).backgroundImage }));
    assert.equal(login.overflow, false); assert.equal(login.image, true); assert.ok(login.background.includes('earth-horizon'));
    await page.type('input[name=email]', 'qa@example.test'); await page.type('input[name=password]', 'invalid-example');
    await page.click('#account-submit'); await page.waitForFunction(() => document.getElementById('account-status').textContent.includes('올바르지'));
    permitLogin = true; await page.type('input[name=password]', 'qa-correct-example'); await page.click('#account-submit');
    await page.waitForFunction(() => window.__godsEyeView?.workspace && document.querySelector('#loading-screen.hidden'), { timeout: 60000 });
    await page.evaluate(() => { window.__godsEyeView.viewer.resolutionScale = .5; window.__godsEyeView.viewer.targetFrameRate = 15; });
    assert.ok(verified > 0); assert.equal(await page.$('#plasma-bgm-control'), null);
    await page.evaluate(() => document.querySelector('[data-first-run-choice="explore"]')?.click());
    await page.type('.plasma-tools input', '서울역'); await page.click('.plasma-tools button[title="위치 검색"]');
    await page.waitForSelector('.pd-search-results button');
    assert.equal((await page.$$('.pd-search-results button')).length, 2);
    await page.click('.pd-search-results li:nth-child(2) button');
    await page.waitForFunction(() => !document.querySelector('.plasma-dialog').open);
    await page.click('#world-connect-toggle'); await page.waitForSelector('.wc-headline', { timeout: 30000 }).catch(async error => {
      console.log(JSON.stringify(await page.evaluate(() => ({ hidden: document.getElementById('world-connect-panel').hidden, text: document.querySelector('.wc-content').innerText })))); throw error;
    });
    await page.click('.wc-headline'); await page.waitForSelector('.wc-question input');
    assert.equal(new URL(page.url()).origin, new URL(base).origin, 'news must open inside the app');
    await page.type('.wc-question input', '출처가 뭐야'); await page.click('.wc-question button');
    await page.waitForFunction(() => document.querySelector('.wc-answer').textContent.includes('출처 기록 응답'), { timeout: 30000 }).catch(async error => {
      await page.screenshot({ path: `output/account-qa/news-failure-${width}.png` });
      console.log(JSON.stringify(await page.evaluate(() => ({ answer: document.querySelector('.wc-answer')?.textContent, news: document.querySelector('.wc-content')?.innerText }))));
      throw error;
    });
    await page.screenshot({ path: `output/account-qa/news-${width}.png` });
    await page.click('[data-wc-tab="satellite"]'); await page.waitForSelector('.satellite-search');
    await page.evaluate(() => { const form = document.querySelector('.satellite-search'); form.querySelector('input[type=range]').value = '100'; });
    await page.click('.satellite-search > button'); await page.waitForSelector('.satellite-scene', { timeout: 30000 });
    await page.click('.satellite-scene > button'); await page.waitForFunction(() => document.querySelector('.satellite-preview img')?.naturalWidth > 0, { timeout: 30000 });
    assert.equal(await page.evaluate(() => window.__godsEyeView.viewer.entities.contains(window.__godsEyeView.viewer.entities.getById('satellite-explorer-selection'))), true);
    await page.screenshot({ path: `output/account-qa/satellite-${width}.png` });
    assert.equal(resources.some(url => /(?:지도의|bgm|background-music).*\.mp3/i.test(decodeURI(url))), false);
    assert.deepEqual(errors, []);
    const state = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth,
      contextLost: window.__godsEyeView.viewer.scene.context._gl.isContextLost(), satellitePreview: document.querySelector('.satellite-preview img')?.naturalWidth > 0 }));
    assert.equal(state.contextLost, false); assert.equal(state.overflow, false);
    const stats = await sharp(`output/account-qa/news-${width}.png`).stats();
    results.push({ width, height, mockedAuth: true, mockedSearch: true, liveNewsFeed: true, realStacFeed: true, login, verified, ...state, imageVariation: stats.channels.map(c => c.stdev) });
    if (width === 1440 && process.env.GEV_SOAK_MS) {
      const duration = Number(process.env.GEV_SOAK_MS); assert.ok(duration >= 30000 && duration <= 1800000);
      await page.click('#world-connect-panel header button');
      await page.evaluate(async () => {
        const api = window.__godsEyeView; api.viewer.resolutionScale = 1; api.viewer.targetFrameRate = 30;
        for (const id of ['flights', 'military', 'satellites', 'earthquakes']) {
          const layer = api.dataManager.layers.get(id); if (!layer.enabled) await api.dataManager.toggle(id);
        }
      });
      const samples = [], started = Date.now();
      while (Date.now() - started < duration) {
        await new Promise(resolve => setTimeout(resolve, 30000));
        const sample = await page.evaluate(() => {
          const api = window.__godsEyeView; api.viewer.camera.moveRight(100); api.viewer.scene.requestRender();
          return { contextLost: api.viewer.scene.context._gl.isContextLost(), frame: api.viewer.scene.frameState.frameNumber,
            layers: [...api.dataManager.layers].filter(([, l]) => l.enabled).map(([id, l]) => ({ id, ...l.module.getStats() })) };
        });
        sample.elapsedMs = Date.now() - started; sample.heapMb = Math.round((await page.metrics()).JSHeapUsedSize / 1048576);
        samples.push(sample); console.log(JSON.stringify({ elapsedMs: sample.elapsedMs, heapMb: sample.heapMb, contextLost: sample.contextLost }));
        writeFileSync('output/account-qa/soak.json', JSON.stringify({ base, duration, mockedAuth: true, samples }, null, 2));
        assert.equal(sample.contextLost, false);
      }
      assert.deepEqual(errors, []); await page.screenshot({ path: 'output/account-qa/soak-final.png' });
    }
    await context.close();
  }
} finally {
  await browser.close(); writeFileSync('output/account-qa/results.json', JSON.stringify({ checkedAt: new Date().toISOString(), base, results }, null, 2));
}
console.log(JSON.stringify(results));
