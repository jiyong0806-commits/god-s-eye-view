import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceDefinition, sourceProvenance, sourceUsage, sourceState } from './sourceRegistry.js';
import { SpatialIntent, parseSpatialIntent } from './intent.js';

test('registered provenance, stale and offline states are separate from license', () => {
  assert.equal(sourceDefinition('usgs-earthquakes').license.code, null);
  const p = sourceProvenance('usgs-earthquakes', { retrievedAt: 1000 });
  assert.equal(sourceState(p, 2000), 'cached'); assert.equal(sourceState(p, 200000), 'stale');
  assert.equal(sourceState({ ...p, freshness: 'offline' }), 'offline');
  assert.throws(() => sourceProvenance('missing', { retrievedAt: 1000 }));
  assert.throws(() => sourceProvenance('osm', { retrievedAt: NaN }));
});
test('unknown/restricted production raster fails closed and attribution is required', () => {
  assert.equal(sourceUsage('osm').allowed, false);
  assert.equal(sourceUsage('hankyung-rss').allowed, false);
  assert.equal(sourceUsage('missing').allowed, false);
  assert.equal(sourceUsage('sentinel-2-earth-search').allowed, false);
  assert.equal(sourceUsage('sentinel-2-earth-search', { attribution: 'Copernicus' }).allowed, true);
});
test('bounded Korean intent fixtures and untrusted output validation', () => {
  assert.equal(parseSpatialIntent('서울의 공원을 보여줘').location, '서울');
  assert.deepEqual(parseSpatialIntent('도쿄 주변 공항 찾아줘').modifiers, ['nearby']);
  assert.equal(parseSpatialIntent('이 두 지점의 거리를 측정해').action, 'measure');
  assert.equal(parseSpatialIntent('이 지역을 작년과 비교해').time, 'previous-year');
  assert.equal(parseSpatialIntent('서울의 위성사진을 보여줘').concept, 'satellite-imagery');
  assert.equal(parseSpatialIntent('알 수 없는 요청'), null);
  assert.equal(SpatialIntent.safeParse({ ...parseSpatialIntent('서울의 공원을 보여줘'), execute: 'rm' }).success, false);
  assert.equal(SpatialIntent.safeParse({ ...parseSpatialIntent('서울의 공원을 보여줘'), action: 'execute' }).success, false);
});
