import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer';
import sharp from 'sharp';

const base = process.argv[2] || 'https://godseyeview-c6q.pages.dev';
mkdirSync('output', { recursive: true });
const browser = await puppeteer.launch({ headless: true,
  executablePath: existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined,
  args: ['--no-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'], timeout: 60000 });
try {
  const page = await browser.newPage(); await page.setViewport({ width: 1440, height: 900 });
  const errors = []; const responses = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', async response => {
    if (new URL(response.url()).pathname !== '/api/ais-live') return;
    try { const data = await response.json(); responses.push({ httpStatus: response.status(), data }); } catch { /* aborted request */ }
  });
  await page.goto(`${base}/map/#v=2&lat=20&lon=0&alt=18000000&pitch=-90&map=nasa-blue-marble&l=a`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => {
    const entry = window.__godsEyeView?.dataManager?.layers.get('ais-live-vessels');
    return entry?.enabled && entry.lifecycleState === 'enabled' && entry.module.getStats().count > 0;
  }, { timeout: 95000 });
  const state = await page.evaluate(() => {
    const gev = window.__godsEyeView;
    const entry = gev.dataManager.layers.get('ais-live-vessels');
    const nearest = entry.module.getNearby(gev.viewer.camera.positionWC, Infinity, 1)[0];
    const record = nearest ? entry.module.findByQuery(nearest.mmsi) : null;
    return { stats: entry.module.getStats(), enabled: entry.enabled, record,
      contextLost: gev.viewer.scene.context._gl.isContextLost() };
  });
  assert.equal(state.enabled, true); assert.equal(state.contextLost, false); assert.ok(state.stats.count > 0);
  const last = responses.at(-1); assert.equal(last.httpStatus, 200); assert.equal(last.data.status, 'live');
  assert.equal(state.stats.count, last.data.rows.length);
  assert.ok(state.record, 'no vessel marker record was available for coordinate verification');
  if (state.record) {
    const source = last.data.rows.find(row => row.mmsi === state.record.mmsi); assert.ok(source);
    assert.equal(state.record.latitude, source.lat); assert.equal(state.record.longitude, source.lon);
  }
  const canvas = await page.$('#cesiumContainer canvas');
  const pixels = await sharp(await canvas.screenshot()).stats();
  assert.ok(pixels.channels.slice(0, 3).some(channel => channel.stdev > 5), 'map canvas is blank');
  await page.screenshot({ path: 'output/public-ais-desktop.png' });
  assert.deepEqual(errors, []);
  const evidence = { base, checkedAt: new Date().toISOString(), state,
    api: { status: last.httpStatus, feed: last.data.status, rows: last.data.rows.length, lastMessageAt: last.data.lastMessageAt },
    canvasDeviation: pixels.channels.slice(0, 3).map(channel => channel.stdev), errors };
  writeFileSync('output/public-ais-verification.json', JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
} finally { await browser.close(); }
