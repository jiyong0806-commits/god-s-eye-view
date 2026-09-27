import test from 'node:test';
import assert from 'node:assert/strict';
import { createVoiceRoutes } from './voiceRoutes.js';

const url = new URL('http://localhost:5000/api/voice/interpret');
const env = { FLOW_LOCAL_RUNTIME: '1', OLLAMA_MODEL: 'example' };
const request = body => new Request(url, { method: 'POST', headers: { origin: url.origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
test('voice rejects malformed contexts instead of calling the model', async () => {
  const route = createVoiceRoutes({ chat: async () => { throw new Error('must not call'); } });
  for (const body of [null, {}, { system: '', messages: [null] }, { system: '', messages: [] }]) {
    assert.equal((await route(request(body), env, url)).status, 400);
  }
});
test('voice serializes local model requests and refuses public model exposure', async () => {
  let finish;
  const route = createVoiceRoutes({ chat: () => new Promise(resolve => { finish = resolve; }) });
  const body = { system: 'Use commands', messages: [{ role: 'user', content: 'hello' }] };
  const first = route(request(body), env, url);
  while (!finish) await new Promise(resolve => setTimeout(resolve, 1));
  assert.equal((await route(request(body), env, url)).status, 429);
  finish({ text: 'done' }); assert.equal((await first).status, 200);
  const publicUrl = new URL('https://public.example/api/voice/interpret');
  const publicRequest = new Request(publicUrl, { method: 'POST', headers: { origin: publicUrl.origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await route(publicRequest, env, publicUrl)).status, 503);
});
