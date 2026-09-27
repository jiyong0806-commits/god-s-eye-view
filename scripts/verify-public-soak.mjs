import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer';

const base = process.argv[2] || 'https://godseyeview-c6q.pages.dev';
const duration = Number(process.env.GEV_SOAK_MS || 600000);
assert.ok(Number.isFinite(duration) && duration >= 30000 && duration <= 1800000);
mkdirSync('output', { recursive: true });
const browser = await puppeteer.launch({ headless: true,
  executablePath: existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined,
  args: ['--no-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=d3d11'], timeout: 60000 });
const samples = [], errors = [], httpErrors = {};
let crashed = false;
const started = Date.now();
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  page.on('error', () => { crashed = true; });
  page.on('pageerror', e => errors.push(e.message.slice(0, 240)));
  page.on('response', r => { if (r.url().startsWith(base + '/api/') && r.status() >= 400) httpErrors[r.status()] = (httpErrors[r.status()] || 0) + 1; });
  await page.goto(base + '/map/#v=2&lat=37.5422&lon=126.9841&alt=900&heading=20&pitch=-28&roll=0&style=normal&map=esri-imagery&l=a.b.c.e.0.1.f.2.w.m.i.o.r.3.s.4.5.h.t.6.7.8.j.k.l.n.p.v.y.9', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.__godsEyeView?.viewer), { timeout: 60000 });
  await page.evaluate(() => document.querySelector('[data-first-run-choice="explore"]')?.click());
  const testingStarted = Date.now();
  while (Date.now() - testingStarted < duration) {
    await new Promise(resolve => setTimeout(resolve, 30000));
    const state = await page.evaluate(() => {
      const v = window.__godsEyeView.viewer;
      v.camera.moveRight(15);
      v.scene.requestRender();
      return { contextLost: v.scene.context._gl.isContextLost(), canvasWidth: v.scene.canvas.width,
        entities: v.entities.values.length, frame: v.scene.frameState.frameNumber };
    });
    const m = await page.metrics();
    const sample = { elapsedMs: Date.now() - testingStarted, heapMb: Math.round(m.JSHeapUsedSize / 1048576), ...state };
    samples.push(sample);
    console.log(JSON.stringify(sample));
    writeFileSync('output/public-soak.json', JSON.stringify({ checkedAt: new Date().toISOString(), base, duration, samples, errors, httpErrors, crashed }, null, 2));
    assert.equal(crashed, false); assert.equal(state.contextLost, false); assert.ok(state.canvasWidth > 0);
  }
  await page.screenshot({ path: 'output/public-soak-final.png' });
} finally { await browser.close(); }
const pass = !crashed && samples.length > 0 && samples.every(s => !s.contextLost) && errors.length === 0;
writeFileSync('output/public-soak.json', JSON.stringify({ checkedAt: new Date().toISOString(), base, duration, totalMs: Date.now() - started, samples, errors, httpErrors, crashed, pass }, null, 2));
assert.ok(pass, 'Soak verification failed; inspect recorded errors, not only the rendered map.');
