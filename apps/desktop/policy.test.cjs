const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { assetPath, isAppUrl } = require('./policy.cjs');
const root = path.resolve('fixture-web');
test('desktop opens bundled map, not the God Flow home', () => {
  assert.equal(assetPath(root, 'gev://app/map/'), path.join(root, 'index.html'));
  assert.equal(assetPath(root, 'gev://app/home/'), path.join(root, 'home/index.html'));
});
test('desktop rejects other hosts, credentials and encoded path escapes', () => {
  for (const url of ['https://evil.test', 'gev://evil/a', 'gev://user:pass@app/a', 'gev://app/%2e%2e%2fsecret', 'gev://app/a%5c..%5csecret', 'gev://app/C:%5csecret']) {
    assert.equal(assetPath(root, url), null, url);
  }
  assert.equal(isAppUrl('javascript:alert(1)'), false);
});
