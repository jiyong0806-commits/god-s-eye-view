import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchPolicy } from './searchPolicy.js';
import { safeAccountReturn, publicAccountConfig } from '../packages/plasma-account/config.js';
import { requirePlasmaAccount } from './plasmaAccount.js';
import { readFileSync } from 'node:fs';

test('fictional and unverified searches require a real-place selection', () => {
  for (const query of ['백룸', '백룸즈', 'The Backrooms', 'BACKROOMS', '아틀란티스', 'Atlantis']) {
    assert.equal(searchPolicy(query).requireSelection, true);
    assert.equal(searchPolicy(query).allowEntityFallback, false);
    assert.ok(searchPolicy(query).warning);
  }
  for (const query of ['Atlantis hotel Dubai', '아틀란티스 호텔', '지평선중학교', '서울역']) assert.equal(searchPolicy(query).requireSelection, false);
});
test('account return targets cannot leave the app or reflect credentials', () => {
  for (const path of ['https://evil.test', '//evil.test', '/\\evil.test', '/auth/', '/map/%2f%2fevil.test', '/map/\n']) assert.equal(safeAccountReturn(path), '/map/');
  assert.equal(safeAccountReturn('/map/?welcome=0&code=private&access_token=private#v=2&lat=37'), '/map/?welcome=0#v=2&lat=37');
  assert.equal(safeAccountReturn('/home/'), '/home/');
});
test('shared account config accepts publishable keys only', () => {
  assert.equal(publicAccountConfig().configured, true);
  assert.equal(publicAccountConfig({ SUPABASE_URL: 'https://other.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_secret_private' }).configured, false);
});
test('anonymous or failed account verification redirects before map startup', async () => {
  for (const getUser of [async () => null, async () => { throw new Error('offline'); }]) {
    let redirect; const current = { pathname: '/map/', search: '?welcome=0', hash: '#v=2', replace: value => { redirect = value; } };
    assert.equal(await requirePlasmaAccount({ getUser, current, listen: false }), false);
    assert.equal(redirect, '/auth/?next=%2Fmap%2F%3Fwelcome%3D0%23v%3D2');
  }
});
test('verified users can continue and startup has no BGM initializer', async () => {
  assert.equal(await requirePlasmaAccount({ getUser: async () => ({ id: 'user' }), current: { pathname: '/map/', search: '', hash: '' }, listen: false }), true);
  const source = readFileSync(new URL('./main.js', import.meta.url), 'utf8');
  assert.equal(source.includes('initPlasmaBgm'), false);
});
