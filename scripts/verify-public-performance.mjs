import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer';
import sharp from 'sharp';

const base = process.argv[2] || 'https://godseyeview-c6q.pages.dev/';
const profiles = [
  { name: 'desktop', viewport: { width: 1440, height: 900, deviceScaleFactor: 1 }, expectedFps: 60 },
  { name: 'mobile', viewport: { width: 393, height: 852, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, expectedFps: 30 },
];
mkdirSync('output', { recursive: true });
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'] });
const results = [];
try {
  for (const profile of profiles) {
    const page = await browser.newPage();
    await page.setViewport(profile.viewport);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message.slice(0, 240)));
    const start = performance.now();
    await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => Boolean(window.__godsEyeView?.viewer), { timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 8000));
    await page.waitForFunction(() => Boolean(window.__godsEyeView?.viewer), { timeout: 60000 });
    await page.evaluate(() => {
      const launcher = document.getElementById('first-run-launcher');
      if (launcher && !launcher.hidden) launcher.querySelector('[data-first-run-choice="explore"]')?.click();
    });
    await new Promise(resolve => setTimeout(resolve, 8000));
    const state = await page.evaluate(() => {
      const viewer = window.__godsEyeView?.viewer;
      if (!viewer) return { viewerMissing: true, url: location.href };
      const overlay = document.getElementById('world-overlay-canvas');
      return { fpsCap: viewer.targetFrameRate, msaaSamples: viewer.scene.msaaSamples,
        coarsePointer: matchMedia('(pointer: coarse)').matches,
        canvasWidth: viewer.scene.canvas.width, canvasHeight: viewer.scene.canvas.height,
        overlayWidth: overlay?.width || 0, overlayCssWidth: overlay?.clientWidth || 0,
        globeVisible: viewer.scene.globe.show, imageryLayers: viewer.imageryLayers.length,
        firstRunOpen: !document.getElementById('first-run-launcher')?.hidden,
        contextLost: viewer.scene.context?._gl?.isContextLost?.() || false };
    });
    const screenshot = `output/public-perf-${profile.name}.png`;
    await page.screenshot({ path: screenshot });
    const image = await sharp(screenshot).stats();
    const metrics = await page.metrics();
    const record = { name: profile.name, url: page.url(), loadAndSettleMs: Math.round(performance.now() - start),
      ...state, screenshot, imageStdev: image.channels.slice(0, 3).map(channel => Math.round(channel.stdev)),
      jsHeapMb: Math.round(metrics.JSHeapUsedSize / 1048576), errors };
    record.pass = record.fpsCap === profile.expectedFps && !record.contextLost
      && record.canvasWidth > 0 && record.canvasHeight > 0
      && record.imageStdev.some(value => value > 15) && errors.length === 0;
    results.push(record);
    console.log(JSON.stringify(record));
    await page.close();
  }
} finally {
  await browser.close();
}
writeFileSync('output/public-performance.json', JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
assert.ok(results.every(result => result.pass), 'Public viewport verification failed');
