import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer';

const base = process.argv[2] || 'http://127.0.0.1:5182';
mkdirSync('output', { recursive: true });
const browser = await puppeteer.launch({ headless: true,
  executablePath: existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined,
  args: ['--no-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'], timeout: 60000 });
const records = [];
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 393, height: 852 }]) {
    const page = await browser.newPage(); await page.setViewport(viewport);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${base}/map/#v=2&lat=37.5&lon=127&alt=18000000&pitch=-90&map=nasa-blue-marble&l=`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#world-connect-toggle', { timeout: 60000 });
    await page.waitForFunction(() => document.getElementById('loading-screen')?.classList.contains('hidden'), { timeout: 60000 });
    await page.evaluate(() => {
      const launcher = document.getElementById('first-run-launcher');
      if (launcher && !launcher.hidden) launcher.querySelector('[data-first-run-choice="explore"]')?.click();
    });
    await page.locator('#world-connect-toggle').click();
    await page.locator('[data-wc-tab="events"]').click();
    try { await page.waitForSelector('.wc-event', { timeout: 30000 }); }
    catch (error) {
      await page.screenshot({ path: 'output/world-connect-failure.png' });
      console.log(await page.evaluate(() => ({ panel: document.getElementById('world-connect-panel')?.textContent,
        hidden: document.getElementById('world-connect-panel')?.hidden,
        point: (() => { const r = document.getElementById('world-connect-toggle').getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.outerHTML.slice(0, 400); })() })));
      throw error;
    }
    const selectedTitle = await page.$eval('.wc-event', e => e.textContent);
    await page.click('.wc-event');
    await page.waitForSelector('.wc-question', { timeout: 30000 });
    const state = await page.evaluate(() => {
      const panel = document.getElementById('world-connect-panel'), rect = panel.getBoundingClientRect();
      return { title: panel.querySelector('h3').textContent, sources: [...panel.querySelectorAll('a')].map(a => a.href),
        relations: panel.querySelectorAll('.wc-relation').length, width: rect.width, right: rect.right,
        height: rect.height, viewportWidth: innerWidth, contextLost: window.__godsEyeView.viewer.scene.context._gl.isContextLost() };
    });
    assert.equal(state.title, selectedTitle); assert.ok(state.sources.every(url => url.startsWith('https://earthquake.usgs.gov/')));
    assert.ok(state.right <= state.viewportWidth && state.width > 300 && state.height > 200); assert.equal(state.contextLost, false);
    await page.locator('.wc-question input').fill('확인된 정보가 무엇인가요?'); await page.locator('.wc-question button').click();
    await page.waitForFunction(() => { const p = document.querySelector('.wc-answer'); return p?.textContent && p.textContent !== '응답 대기 중…'; }, { timeout: 95000 });
    const answer = await page.$eval('.wc-answer', el => el.textContent);
    await page.screenshot({ path: `output/world-connect-${viewport.width}.png` });
    await page.click('#world-connect-panel header button');
    assert.equal(await page.$eval('#world-connect-panel', p => p.hidden), true);
    records.push({ viewport, ...state, answer, errors }); assert.deepEqual(errors, []); await page.close();
  }
} finally { await browser.close(); }
writeFileSync('output/world-connect-verification.json', JSON.stringify({ base, checkedAt: new Date().toISOString(), records }, null, 2));
console.log(JSON.stringify(records));
