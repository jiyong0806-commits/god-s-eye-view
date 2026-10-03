import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestImage, cancelImageRequest } from './imageRequest.js';
const image = () => ({ removeAttribute() { delete this.src; } });
test('hanging CCTV request frees its slot exactly once', async () => {
  const img = image(), calls = []; requestImage(img, '/frame', ok => calls.push(ok), 10);
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.deepEqual(calls, [false]); assert.equal(img.onload, null); assert.equal(img.src, undefined);
});
test('successful frame has no later timeout and cancelled hidden frame never settles', async () => {
  const img = image(), cancelled = image(), calls = [];
  requestImage(img, '/frame', ok => calls.push(ok), 10); img.onload();
  requestImage(cancelled, '/frame', () => calls.push('cancelled'), 10); cancelImageRequest(cancelled);
  await new Promise(resolve => setTimeout(resolve, 30)); assert.deepEqual(calls, [true]);
});
