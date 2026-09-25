import { cachedProvider, dailyBudget, failure, jsonFeed, reply, reserveBudget, retrySeconds, upstream } from './providerRuntime.js';

const CALTRANS = 'https://cwwp2.dot.ca.gov/data/d4/cctv/cctvStatusD04.json';
let cameras = new Map();

async function cameraCatalog() {
  return cachedProvider('caltrans-catalog', 'Caltrans', 900000, async () => {
    const res = await upstream(CALTRANS);
    if (!res.ok) return failure('Caltrans', res.status, `카메라 목록 HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data.data)) return failure('Caltrans', 502, '카메라 목록 형식 불일치');
    const sources = [];
    for (const item of data.data) {
      const camera = item.cctv;
      const location = camera?.location;
      const lat = Number(location?.latitude), lon = Number(location?.longitude);
      const imageUrl = camera?.imageData?.static?.currentImageURL;
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || !imageUrl || !/^\d+$/.test(String(camera.index)) || camera.inService !== 'true') continue;
      let image;
      try { image = new URL(imageUrl); } catch { continue; }
      if (image.protocol !== 'https:' || !image.hostname.endsWith('.dot.ca.gov')) continue;
      const id = `caltrans-${camera.index}`;
      sources.push({ id, name: location.locationName || `Caltrans ${camera.index}`, cityId: 'san-francisco',
        city: 'San Francisco Bay Area', lat, lon, feedType: 'image', sourceKind: 'caltrans-open-data',
        imageUrl: image.href, url: `/api/cctv/frame/${id}`, provider: 'Caltrans', enabled: true, refreshIntervalMs: 60000 });
      if (sources.length >= 120) break;
    }
    cameras = new Map(sources.map(row => [row.id, row]));
    return reply({ sources, count: sources.length, source: 'Caltrans', fetchedAt: Date.now(), coverage: 'California District 4' });
  });
}

async function cctv(url) {
  const catalog = await cameraCatalog();
  if (!catalog.ok || url.pathname === '/api/cctv/sources') return catalog;
  if (url.pathname === '/api/cctv/health') return reply({ cameras: [...cameras.values()].map(row => ({ id: row.id,
    status: 'unknown', message: '이미지 요청 시 연결 확인', feedType: 'image' })) });
  const match = /^\/api\/cctv\/(frame|media|stream)\/(caltrans-\d+)$/.exec(url.pathname);
  if (!match || !cameras.has(match[2])) return failure('Caltrans', 404, '해당 카메라가 공급자 목록에 없습니다.', 900);
  const camera = cameras.get(match[2]);
  if (match[1] === 'stream') return reply({ ...camera, frameUrl: `/api/cctv/frame/${camera.id}`, mediaUrl: `/api/cctv/media/${camera.id}` });
  return cachedProvider(`frame:${camera.id}`, 'Caltrans images', 60000, async () => {
    const res = await upstream(camera.imageUrl, { redirect: 'error' }, 8000);
    if (!res.ok) return failure('Caltrans', res.status, `카메라 이미지 HTTP ${res.status}`);
    if (!res.headers.get('content-type')?.startsWith('image/')) return failure('Caltrans', 502, '영상 대신 잘못된 형식이 반환되었습니다.');
    return new Response(res.body, { headers: { 'content-type': res.headers.get('content-type'), 'cache-control': 'public, max-age=60' } });
  });
}

async function tomtom(request, env, url) {
  const ready = Boolean(env.TOMTOM_API_KEY && env.PROVIDER_DB?.prepare);
  if (url.pathname === '/api/tomtom/status') {
    let dailyCount = 0;
    if (ready) {
      const row = await env.PROVIDER_DB.prepare('SELECT count FROM provider_usage WHERE service = ? AND day = ? AND scope = ?')
        .bind('tomtom', new Date().toISOString().slice(0, 10), 'global').first();
      dailyCount = row?.count || 0;
    }
    return reply({ hasKey: ready, configured: Boolean(env.TOMTOM_API_KEY), available: ready,
      dailyCount, budget: dailyBudget(env, 'tomtom'), date: new Date().toISOString().slice(0, 10),
      error: ready ? null : !env.TOMTOM_API_KEY ? '서버 TomTom 키 누락' : '일일 500회 한도 저장소 연결 필요' });
  }
  if (!ready) return failure('TomTom', 503, !env.TOMTOM_API_KEY ? '서버 TomTom 키 누락' : '일일 500회 한도 저장소 연결 필요', 900);
  const tile = /^\/api\/tomtom\/flow\/(\d+)\/(\d+)\/(\d+)\.pbf$/.exec(url.pathname);
  if (!tile) return failure('TomTom', 400, '잘못된 교통 타일 좌표');
  const [z, x, y] = tile.slice(1).map(Number);
  if (z > 18 || x >= 2 ** z || y >= 2 ** z) return failure('TomTom', 400, '교통 타일 범위 초과');
  return cachedProvider(`tomtom:${z}/${x}/${y}`, 'TomTom', 300000, async () => {
    if (!await reserveBudget(env, 'tomtom')) return failure('TomTom', 429, '하루 500회 요청 한도에 도달했습니다.', 3600);
    const res = await upstream(`https://api.tomtom.com/traffic/map/4/tile/flow/relative/${z}/${x}/${y}.pbf?key=${encodeURIComponent(env.TOMTOM_API_KEY)}`);
    if (!res.ok) return failure('TomTom', res.status, `교통 공급자 HTTP ${res.status}`, retrySeconds(res.headers.get('retry-after')));
    return new Response(res.body, { headers: { 'content-type': 'application/x-protobuf', 'cache-control': 'public, max-age=300' } });
  });
}

export async function extraRoutes(request, env, url) {
  const path = url.pathname;
  if (request.method !== 'GET' && (path.startsWith('/api/cctv/') || path.startsWith('/api/tomtom/') || path === '/api/launches')) {
    return reply({ error: 'method-not-allowed' }, 405);
  }
  if (path.startsWith('/api/cctv/')) return cctv(url);
  if (path.startsWith('/api/tomtom/')) return tomtom(request, env, url);
  if (path === '/api/launches') return jsonFeed('https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=30&mode=detailed',
    'Launch Library 2', 1800, data => Array.isArray(data?.results));
  if (path === '/api/elevenlabs/status') return reply({ enabled: env.GEV_TTS_ENABLED === '1' &&
    Boolean(env.ELEVENLABS_API_KEY && env.ELEVENLABS_VOICE_ID && env.PROVIDER_DB?.prepare),
    provider: 'ElevenLabs', budget: dailyBudget(env, 'elevenlabs'),
    reason: env.GEV_TTS_ENABLED !== '1' ? '서버 음성 출력 비활성화' :
      !env.ELEVENLABS_API_KEY ? '서버 키 누락' : !env.ELEVENLABS_VOICE_ID ? '음성 ID 미설정' :
      !env.PROVIDER_DB?.prepare ? '서버 사용 한도 저장소 미설정' : null });
  if (path === '/api/weather-effects') return failure('Weather provider', 503, '공개 서비스용 기상 공급자 연결이 필요합니다.', 900);
  if (path === '/api/setup/status') return reply({ ok: true, external: true, providers: {} });
  if (path.startsWith('/api/realtime/')) return failure('Browser speech', 503, '브라우저 한국어 음성 인식을 사용합니다.', 900);
  if (path === '/api/openrouter/chat') return failure('Voice commands', 503, '서버 AI 미연결: 기본 한국어 명령을 사용합니다.', 900);
  return null;
}
