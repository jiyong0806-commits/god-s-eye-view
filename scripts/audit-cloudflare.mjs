import { mkdirSync, writeFileSync } from 'node:fs';

const base = 'https://godseyeview-c6q.pages.dev';
const paths = ['/', '/home/', '/event/', '/app-icon.png', '/fonts/PretendardVariable.woff2',
  '/media/earth-horizon.webp', '/api/flow/status', '/api/firms/status', '/api/firms',
  '/api/opensky?lat=37.5665&lon=126.978', '/api/adsblol/mil', '/api/celestrak/stations',
  '/api/ais-live', '/api/weather-effects', '/api/rainviewer/metadata', '/api/tomtom/status',
  '/api/geocode?q=%EC%84%9C%EC%9A%B8', '/api/cctv/sources'];
const rows = [];
for (const pathname of paths) {
  const start = performance.now();
  try {
    const response = await fetch(base + pathname, { signal: AbortSignal.timeout(65000) });
    const type = response.headers.get('content-type') || '';
    const bytes = new Uint8Array(await response.arrayBuffer());
    let data;
    if (type.includes('json')) data = JSON.parse(new TextDecoder().decode(bytes));
    const row = { path: pathname, status: response.status, type, bytes: bytes.length,
      ms: Math.round(performance.now() - start), provider: response.headers.get('x-flight-source') || data?.provider,
      retryAfter: response.headers.get('retry-after'), count: data?.count ?? data?.states?.length ?? data?.ac?.length,
      reason: data?.error || data?.reason, hasKey: data?.hasKey,
      apiReturnedHtml: pathname.startsWith('/api/') && type.includes('text/html') };
    rows.push(row); console.log(JSON.stringify(row));
  } catch (error) {
    const row = { path: pathname, error: error.name, ms: Math.round(performance.now() - start) };
    rows.push(row); console.log(JSON.stringify(row));
  }
}
mkdirSync('output', { recursive: true });
writeFileSync('output/cloudflare-audit.json', JSON.stringify({ checkedAt: new Date().toISOString(), base, rows }, null, 2));
