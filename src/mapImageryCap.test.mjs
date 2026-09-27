import test from 'node:test';
import assert from 'node:assert/strict';
import { capImageryLevel, ESRI_RELIABLE_MAXIMUM_LEVEL } from './mapStackController.js';

test('Esri imagery caps sparse high zoom tiles without altering the provider', () => {
  const original = {
    maximumLevel: 23,
    requestImage(x, y, level) { return [this.maximumLevel, x, y, level]; },
  };
  const capped = capImageryLevel(original, ESRI_RELIABLE_MAXIMUM_LEVEL);
  assert.equal(capped.maximumLevel, 19);
  assert.equal(original.maximumLevel, 23);
  assert.deepEqual(capped.requestImage(1, 2, 19), [23, 1, 2, 19]);
  assert.equal(capImageryLevel({ maximumLevel: 17 }, 19).maximumLevel, 17);
});
