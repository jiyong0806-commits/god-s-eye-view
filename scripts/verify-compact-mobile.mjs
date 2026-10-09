import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer';
import sharp from 'sharp';

const base = process.argv[2] || 'http://127.0.0.1:5192';
const baseline = process.argv.includes('--baseline');
const output = `output/mobile-compact/${baseline ? 'before' : 'after'}`;
mkdirSync(output, { recursive: true });
const browser = await puppeteer.launch({ headless: true,
  executablePath: existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined,
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=d3d11'] });
const user = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'qa@example.test', user_metadata: {}, app_metadata: {} };
const token = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.qa-only`;
const results = [];
const views = baseline ? [[393, 852], [1440, 900]] : [[320, 568], [393, 852], [430, 932], [852, 393], [1440, 900]];
try {
  for (const [width, height] of views) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1, hasTouch: width !== 1440, isMobile: width !== 1440 });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.evaluateOnNewDocument((session) => localStorage.setItem('sb-jjmkhfqxzvhlblmgljwp-auth-token', JSON.stringify(session)), {
      access_token: token, refresh_token: 'qa-only-not-real', expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600, token_type: 'bearer', user,
    });
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url());
      const reply = body => request.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, body: JSON.stringify(body) });
      if (url.hostname.endsWith('.supabase.co')) {
        if (request.method() === 'OPTIONS') return request.respond({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PUT,DELETE' } });
        return reply(url.pathname === '/auth/v1/user' ? user : null);
      }
      if (url.pathname === '/api/world-connect/news') return reply({ articles: [] });
      if (url.pathname === '/api/world-connect/events') return reply({ events: [] });
      return request.continue();
    });
    await page.goto(`${base}/map/#v=2&lat=37.5&lon=127&alt=18000000&pitch=-90&map=nasa-blue-marble&l=`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__godsEyeView?.workspace && document.querySelector('#loading-screen.hidden'), { timeout: 60000 }).catch(async error => {
      await page.screenshot({ path: `${output}/startup-failure-${width}.png` });
      console.log(JSON.stringify({ width, url: page.url(), errors, state: await page.evaluate(() => ({ loading: document.getElementById('loading-screen')?.innerText, account: document.getElementById('account-status')?.innerText, appReady: Boolean(window.__godsEyeView) })) }));
      throw error;
    });
    await page.evaluate(() => {
      document.querySelector('[data-first-run-choice="explore"]')?.click();
      window.__godsEyeView.viewer.resolutionScale = .5; window.__godsEyeView.viewer.targetFrameRate = 15;
    });
    await page.evaluate(() => document.fonts.ready);
    await new Promise(resolve => setTimeout(resolve, 3000));
    const compact = width <= 760 || (width <= 950 && height <= 500);
    const layout = await page.evaluate(() => {
      const bounds = selector => {
        const r = document.querySelector(selector).getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom, right: r.right };
      };
      const controls = [...document.querySelectorAll('#left-panel-stack > [data-panel-id], #right-context-rail > [data-panel-id]')]
        .map(node => ({ id: node.id, ...bounds(`#${node.id}`) }));
      return { tools: bounds('.plasma-tools'), controls, title: bounds('#title-bar'),
        topOccupied: Math.max(...controls.map(c => c.bottom)), overflow: document.documentElement.scrollWidth > innerWidth,
        inputFont: getComputedStyle(document.querySelector('.plasma-tools input')).fontSize };
    });
    assert.equal(layout.overflow, false);
    await page.screenshot({ path: `${output}/map-${width}.png` });
    const screenshotStats = await sharp(`${output}/map-${width}.png`).stats();
    assert.ok(screenshotStats.channels.slice(0, 3).some(c => c.stdev > 5), 'map must not be blank');
    const canvas = await page.$('.cesium-widget canvas');
    const pixels = await sharp(await canvas.screenshot()).extract({ left: Math.floor(width * .3), top: Math.floor(height * .4), width: Math.floor(width * .4), height: Math.floor(height * .2) }).stats();
    assert.ok(pixels.channels.slice(0, 3).some(c => c.mean > 12 && c.stdev > 5), 'the globe canvas must contain rendered imagery');
    if (compact && !baseline) {
      assert.equal(layout.controls.length, 5);
      assert.ok(layout.controls.every(c => c.height <= 37 && c.right <= width && c.x >= 0), JSON.stringify(layout.controls));
      assert.ok(layout.controls.every(c => Math.abs(c.y - layout.controls[0].y) < 1), 'panel launchers must share one row');
      assert.ok(layout.topOccupied <= 136, 'compact controls must leave the map visible');
      assert.equal(layout.inputFont, '16px');
      const hit = layout.controls[0];
      await page.mouse.click(hit.x + hit.width / 2, hit.y + hit.height / 2);
      await page.waitForFunction(() => !document.getElementById('data-panel').classList.contains('collapsed'));
      assert.equal(await page.$eval('#command-dock', node => getComputedStyle(node).display), 'none');
      const expanded = await page.$eval('#data-panel', panel => {
        const r = panel.getBoundingClientRect(), list = panel.querySelector('.data-toggle-list');
        list.scrollTop = list.scrollHeight;
        return { width: r.width, height: r.height, right: r.right, bottom: r.bottom, listHeight: list.clientHeight, scrollable: list.scrollTop > 0 };
      });
      assert.ok(expanded.width <= 342 && expanded.right <= width && expanded.height <= 391 && expanded.listHeight > 50, JSON.stringify(expanded));
      assert.equal(expanded.scrollable, true);
      await page.screenshot({ path: `${output}/layers-${width}.png` });
      for (const panel of layout.controls.filter(c => c.id !== 'data-panel')) {
        await page.mouse.click(panel.x + panel.width / 2, panel.y + panel.height / 2);
        await page.waitForFunction(id => {
          const all = [...document.querySelectorAll('#left-panel-stack > [data-panel-id], #right-context-rail > [data-panel-id]')];
          return all.every(node => node.classList.contains('collapsed') === (node.id !== id));
        }, {}, panel.id).catch(async error => {
          await page.screenshot({ path: `${output}/panel-failure-${panel.id}-${width}.png` });
          console.log(JSON.stringify({ width, clickedPanel: panel.id, panels: await page.evaluate(() => [...document.querySelectorAll('[data-panel-id]')].map(n => ({ id: n.id, collapsed: n.classList.contains('collapsed') }))) }));
          throw error;
        });
        const rect = await page.$eval(`#${panel.id}`, node => { const r = node.getBoundingClientRect(); return { width: r.width, height: r.height, bottom: r.bottom, right: r.right }; });
        assert.ok(rect.width <= 342 && rect.right <= width && rect.height <= 391 && rect.bottom <= height - 70, `${panel.id}: ${JSON.stringify(rect)}`);
      }
      await page.click('#world-connect-toggle');
      await page.waitForFunction(() => !document.getElementById('world-connect-panel').hidden && document.getElementById('global-context-panel').classList.contains('collapsed'));
      const world = await page.$eval('#world-connect-panel', node => { const r = node.getBoundingClientRect(); return { height: r.height, right: r.right, bottom: r.bottom }; });
      assert.ok(world.height <= 421 && world.right <= width && world.bottom <= height - 70);
      assert.equal(await page.$eval('#command-dock', node => getComputedStyle(node).display), 'none');
      await page.screenshot({ path: `${output}/world-${width}.png` });
      await page.click('#world-connect-panel header button');
      await page.click('#plasma-account-action');
      await page.waitForSelector('.plasma-dialog[open]');
      const modal = await page.$eval('.plasma-dialog', node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom }; });
      assert.ok(modal.width <= Math.min(362, width - 22) && modal.height <= 482 && modal.bottom <= height && modal.y >= 12);
      assert.ok(Math.abs(modal.x - (width - modal.width) / 2) < 1, 'mobile modal must be centered');
      await page.screenshot({ path: `${output}/account-${width}.png` });
      layout.expanded = expanded; layout.world = world; layout.modal = modal;
    }
    if (!compact && !baseline && existsSync('output/mobile-compact/before/results.json')) {
      const before = JSON.parse(readFileSync('output/mobile-compact/before/results.json', 'utf8')).results.find(item => item.width === width);
      if (before) {
        for (const [name, current, previous] of [['tools', layout.tools, before.tools], ['title', layout.title, before.title], ...layout.controls.map((node, i) => [node.id, node, before.controls[i]])]) {
          for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(current[key] - previous[key]) <= 1, `desktop ${name}.${key} must be unchanged`);
        }
      }
    }
    assert.deepEqual(errors, []);
    assert.equal(await page.evaluate(() => window.__godsEyeView.viewer.scene.context._gl.isContextLost()), false);
    results.push({ width, height, mockedAuth: true, mockedNews: true, ...layout });
    await context.close();
  }
} finally {
  await browser.close();
  writeFileSync(`${output}/results.json`, JSON.stringify({ base, baseline, results }, null, 2));
}
console.log(JSON.stringify(results));
