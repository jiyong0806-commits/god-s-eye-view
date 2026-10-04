import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer';
import sharp from 'sharp';

const base = process.argv[2] || 'http://127.0.0.1:5176';
mkdirSync('output', { recursive: true });
const browser = await puppeteer.launch({ headless: true,
  executablePath: existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined,
  args: ['--no-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=d3d11'] });
const results = [];
const viewports = [[1440, 900], [834, 1112], [393, 852], [852, 393]];
const requestedWidth = process.argv[3] ? Number(process.argv[3]) : null;
assert.ok(requestedWidth == null || viewports.some(([width]) => width === requestedWidth), 'unsupported QA viewport');
try {
  for (const [width, height] of viewports.filter(([width]) => requestedWidth == null || width === requestedWidth)) {
    const page = await browser.newPage();
    await page.setViewport({ width, height, hasTouch: width < 1100, isMobile: width < 1100, deviceScaleFactor: 1 });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const start = performance.now();
    await page.goto(`${base}/map/#v=2&lat=37.5&lon=127&alt=18000000&pitch=-90&map=nasa-blue-marble&l=`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__godsEyeView?.workspace && document.querySelector('#loading-screen.hidden'), { timeout: 60000 });
    const readyMs = Math.round(performance.now() - start);
    await page.evaluate(() => document.querySelector('[data-first-run-choice="explore"]')?.click());
    await new Promise(resolve => setTimeout(resolve, 1400));
    await page.type('.plasma-tools input', '서울역');
    await page.click('.plasma-tools button[title="위치 검색"]');
    await page.waitForSelector('.pd-search-results button', { timeout: 30000 });
    const before = await page.evaluate(() => window.__godsEyeView.viewer.camera.positionCartographic.height);
    const choices = await page.$$eval('.pd-search-results button', rows => rows.map(row => row.textContent));
    assert.ok(choices.length > 1); assert.ok(before > 1000000, 'multiple results must not auto-fly');
    await page.screenshot({ path: `output/search-options-${width}.png` });
    await page.click('.pd-search-results li:nth-child(2) button');
    await page.waitForFunction(() => !document.querySelector('.plasma-dialog').open && window.__godsEyeView.viewer.camera.positionCartographic.height < 10000, { timeout: 15000 });
    await page.click('#plasma-account-action');
    await page.waitForFunction(() => document.querySelector('.plasma-dialog').open, { timeout: 5000 }).catch(async error => {
      await page.screenshot({ path: `output/account-click-failure-${width}.png` });
      console.log(JSON.stringify(await page.evaluate(() => { const b = document.getElementById('plasma-account-action'), r = b.getBoundingClientRect();
        return { button: r.toJSON(), intercept: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.outerHTML.slice(0, 250) }; }))); throw error;
    });
    await page.waitForFunction(() => document.querySelector('.pd-status')?.textContent !== '계정 서버 확인 중…', { timeout: 20000 });
    await page.click('.plasma-dialog button[title="닫기"]');
    if (width <= 760) {
      await page.click('#data-panel .panel-collapse-btn');
      await page.waitForFunction(() => !document.getElementById('data-panel').classList.contains('collapsed'));
      const expanded = await page.$eval('#data-panel', panel => ({ height: panel.getBoundingClientRect().height,
        listHeight: panel.querySelector('.data-toggle-list').getBoundingClientRect().height }));
      assert.ok(expanded.height > 120 && expanded.listHeight > 60, 'expanded mobile layers must remain usable');
      await page.click('#data-panel .panel-collapse-btn');
    }
    await page.click('#reset-globe-view');
    await page.waitForFunction(() => window.__godsEyeView.viewer.camera.positionCartographic.height > 1000000);
    await new Promise(resolve => setTimeout(resolve, 1800));
    const layout = await page.evaluate(() => {
      const bounds = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
      const tools = bounds(document.querySelector('.plasma-tools'));
      const buttons = [...document.querySelectorAll('#top-center-actions button')].map(bounds);
      const headers = [...document.querySelectorAll('#left-panel-stack > .collapsed, #right-context-rail > .collapsed')].map(panel => {
        const header = panel.querySelector('.panel-header, .pp-header-row'); return { panel: bounds(panel), header: bounds(header) };
      });
      const creditParts = [...document.querySelectorAll('#cesium-credits img, #cesium-credits a')].map(bounds).filter(row => row.width > 0 && row.height > 0);
      const credits = creditParts.length ? { y: Math.min(...creditParts.map(row => row.y)), parts: creditParts.length }
        : { ...bounds(document.getElementById('cesium-credits')), parts: 0 };
      const dock = bounds(document.getElementById('command-dock'));
      return { tools, buttons, headers, credits, dock, contextLost: window.__godsEyeView.viewer.scene.context._gl.isContextLost(), overflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert.equal(layout.buttons.length, 5); assert.ok(layout.buttons.every(row => row.bottom <= height && row.right <= width));
    assert.ok(layout.buttons.every(row => Math.abs(row.y - layout.buttons[0].y) < 1), `action row must remain aligned: ${JSON.stringify(layout.buttons)}`);
    assert.ok(layout.buttons[0].y > height / 2); assert.ok(layout.tools.right <= width);
    assert.equal(layout.contextLost, false); assert.equal(layout.overflow, false); assert.deepEqual(errors, []);
    if (width <= 760) assert.ok(layout.headers.every(row => row.header.bottom <= row.panel.bottom + 1), `mobile headers must not be clipped: ${JSON.stringify(layout.headers)}`);
    assert.ok(layout.credits.parts > 0, 'map source attribution must render');
    if (width <= 760) assert.ok(layout.dock.bottom <= layout.credits.y, 'mobile command dock must not cover map attribution');
    await page.screenshot({ path: `output/search-layout-${width}.png` });
    const region = await sharp(`output/search-layout-${width}.png`).extract({ left: Math.floor(width / 3), top: Math.floor(height / 3), width: Math.floor(width / 3), height: Math.floor(height / 3) }).stats();
    results.push({ width, height, readyMs, choices: choices.length, account: true, ...layout, mapPixelVariation: region.channels.map(row => row.stdev) });
    if (width === 1440) {
      const daily = await page.evaluate(async () => {
        const state = await window.__godsEyeView.mapStackController.setStack('nasa-daily');
        return { activeId: state.activeId, imageryDate: state.imageryDate, lastError: state.lastError };
      });
      assert.equal(daily.activeId, 'nasa-daily'); assert.match(daily.imageryDate, /^2026-10-/); assert.equal(daily.lastError, null);
      await page.click('#reset-globe-view');
      await page.waitForFunction(() => window.__godsEyeView.viewer.camera.positionCartographic.height > 1000000);
      await new Promise(resolve => setTimeout(resolve, 7000));
      await page.screenshot({ path: 'output/nasa-daily-2026-10.png' }); results.at(-1).daily = daily;
    }
    await page.close();
  }
} finally {
  await browser.close();
  writeFileSync('output/search-layout-verification.json', JSON.stringify({ checkedAt: new Date().toISOString(), base, results }, null, 2));
}
console.log(JSON.stringify(results));
