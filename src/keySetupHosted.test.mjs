import test from 'node:test';
import assert from 'node:assert/strict';
import { initKeySetup } from './keySetup.js';

for (const [name, status] of [
  ['externally managed hosted keys', { external: true, providers: {} }],
  ['externally managed keys with a registry', { external: true, keys: [] }],
  ['a malformed setup response', { ok: true }],
]) {
  test(`removes the local-only editor for ${name}`, async () => {
    const removed = [];
    const nodes = new Map(['key-setup-chip', 'key-setup'].map(id => [id, {
      dataset: {}, remove() { removed.push(id); },
    }]));
    const result = await initKeySetup({ documentRef: { getElementById: id => nodes.get(id) },
      fetchImpl: async () => Response.json(status) });
    assert.equal(result, null);
    assert.deepEqual(removed, ['key-setup-chip', 'key-setup']);
  });
}
