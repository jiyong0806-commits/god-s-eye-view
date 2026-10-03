import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer';

const base = process.argv[2] || 'https://godseyeview-c6q.pages.dev';
mkdirSync('output', { recursive: true });
const browser = await puppeteer.launch({ headless: true,
  executablePath: existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined,
  args: ['--no-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=d3d11'], timeout: 60000 });
const records = [];
try {
  for (const width of [1440, 393]) {
    const page = await browser.newPage(); await page.setViewport({ width, height: width === 393 ? 852 : 900 });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/map/#v=2&lat=37.5&lon=127&alt=18000000&pitch=-90&map=nasa-blue-marble&l=`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('.plasma-tools', { timeout: 60000 });
    await page.waitForFunction(() => document.getElementById('loading-screen')?.classList.contains('hidden'), { timeout: 60000 });
    await page.evaluate(() => document.querySelector('[data-first-run-choice="explore"]')?.click());
    await new Promise(resolve => setTimeout(resolve, 1200));
    await page.waitForSelector('.plasma-tools', { timeout: 30000 });
    const click = async title => {
      console.log(JSON.stringify({ width, step: title }));
      const selector = `button[title="${title}"]`;
      const hidden = await page.$eval(selector, node => node.getBoundingClientRect().width === 0);
      if (hidden) await page.click('.plasma-more');
      return page.click(selector);
    };
    await click('PLASMA 계정 설정');
    await page.waitForSelector('.plasma-dialog input[name="email"]', { timeout: 20000 });
    await page.waitForFunction(() => { const image = document.querySelector('.pd-logo'); return image?.complete && image.naturalWidth > 0; }, { timeout: 20000 });
    assert.equal(await page.$eval('.pd-logo', image => image.complete && image.naturalWidth > 0), true);
    await page.click('.plasma-dialog button[title="닫기"]');
    await click('찜한 위치');
    await page.waitForSelector('.plasma-dialog input[name="name"]', { timeout: 20000 });
    await page.type('.plasma-dialog input[name="name"]', 'QA 위치');
    await page.click('.plasma-dialog form button[type="submit"]');
    await page.waitForSelector('.pd-row button[title="찜 위치로 이동"]', { timeout: 20000 });
    await page.click('.pd-row button[title="찜 위치로 이동"]');
    await page.waitForFunction(() => !document.querySelector('.plasma-dialog').open);
    await page.type('.plasma-tools form input', '지평선중학교');
    await click('위치 검색');
    await page.waitForFunction(() => document.querySelector('.pd-search-results') || window.__godsEyeView.viewer.camera.positionCartographic.height < 10000);
    const candidate = await page.$('.pd-search-results button');
    if (candidate) await candidate.click();
    await page.waitForFunction(() => {
      const p = window.__godsEyeView.viewer.camera.positionCartographic;
      return Math.abs(p.latitude * 180 / Math.PI - 35.827415) < .05
        && Math.abs(p.longitude * 180 / Math.PI - 126.830054) < .05;
    }, { timeout: 30000 });
    await click('OSM 2D / 3D 지도');
    await page.waitForFunction(() => window.__godsEyeView.viewer.scene.mode === 2, { timeout: 20000 });
    await click('OSM 2D / 3D 지도');
    await page.waitForFunction(() => window.__godsEyeView.viewer.scene.mode === 3, { timeout: 20000 });
    await click('튜토리얼');
    assert.match(await page.$eval('.plasma-dialog h2', node => node.textContent), /1 \/ 5/);
    await page.click('.plasma-dialog button[title="닫기"]');
    await page.click('#world-connect-toggle');
    try { await page.waitForSelector('.wc-news', { timeout: 30000 }); }
    catch (error) {
      console.log(JSON.stringify(await page.evaluate(() => { const b = document.getElementById('world-connect-toggle'), r = b.getBoundingClientRect(); return {
        panel: document.getElementById('world-connect-panel')?.textContent, hidden: document.getElementById('world-connect-panel')?.hidden,
        intercept: document.elementFromPoint(r.x+r.width/2, r.y+r.height/2)?.outerHTML.slice(0, 300) }; })));
      await page.screenshot({ path: `output/plasma-workspace-failure-${width}.png` }); throw error;
    }
    const news = await page.$$eval('.wc-news > a', links => links.map(link => link.href));
    assert.ok(news.length > 0 && news.every(url => url.startsWith('https://www.hankyung.com/article/')));
    await page.click('#world-connect-panel header button');
    await click('날씨 레이더 모드');
    await page.waitForFunction(() => document.getElementById('plasma-notice')?.textContent?.length > 0, { timeout: 30000 });
    const radarReason = await page.$eval('#plasma-notice', node => node.textContent);
    await page.screenshot({ path: `output/plasma-workspace-${width}.png` });
    const state = await page.evaluate(() => { const r = document.querySelector('.plasma-tools').getBoundingClientRect();
      return { toolWidth: r.width, toolRight: r.right, viewport: innerWidth, contextLost: window.__godsEyeView.viewer.scene.context._gl.isContextLost() }; });
    assert.ok(state.toolRight <= state.viewport + 1); assert.equal(state.contextLost, false); assert.deepEqual(errors, []);
    records.push({ width, ...state, accountForm: true, bookmarks: true, koreanSchoolFlyTo: true, mapModes: true, news: news.length, radarReason, errors });
    writeFileSync('output/plasma-workspace-verification.json', JSON.stringify({ checkedAt: new Date().toISOString(), base, records }, null, 2));
    await page.close();
  }
} finally { await browser.close(); }
writeFileSync('output/plasma-workspace-verification.json', JSON.stringify({ checkedAt: new Date().toISOString(), base, records }, null, 2));
console.log(JSON.stringify(records));
