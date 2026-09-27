import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { cachedProvider, failure, reply, upstream } from './providerRuntime.js';

const NEWS = 'https://www.hankyung.com/feed/economy';
const KMA = 'https://www.weather.go.kr/w/rss/cap/eqk.do';
const USGS = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson';
const parser = new XMLParser({ ignoreAttributes: false, processEntities: false, trimValues: true });
const array = value => !value ? [] : Array.isArray(value) ? value : [value];
export function parseFeed(xml) {
  if (xml.length > 1000000 || /<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw new Error('Invalid XML');
  return array(parser.parse(xml)?.rss?.channel?.item);
}
export function newsFromRss(xml, now = Date.now()) {
  return parseFeed(xml).slice(0, 100).flatMap(item => {
    let url; try { url = new URL(String(item.link)); } catch { return []; }
    const publishedAt = Date.parse(String(item.pubDate));
    if (url.protocol !== 'https:' || url.hostname !== 'www.hankyung.com' || !/^\/article\/\d+$/.test(url.pathname)
      || !Number.isFinite(publishedAt) || publishedAt > now + 60000 || now - publishedAt > 7 * 86400000) return [];
    return [{ id: url.pathname.split('/').at(-1), title: String(item.title || '').slice(0, 200), url: url.href,
      publishedAt, provider: '한국경제', author: String(item.author || '').slice(0, 80), category: '경제',
      image: null, photoSourceUrl: url.href, evidence: '발행사의 공식 RSS 제목·발행 시각. 기사 본문·사진은 재배포하지 않습니다.',
      limitations: '단일 매체 보도. 인과 관계·투자 수익·피해 예측 분석이 아닙니다.' }];
  }).filter(row => row.title).slice(0, 30);
}
export function currentEarthquakes(feed, now = Date.now()) {
  if (!Array.isArray(feed?.features)) throw new Error('Invalid earthquake feed');
  return feed.features.slice(0, 4000).flatMap(feature => {
    const p = feature.properties, c = feature.geometry?.coordinates;
    if (typeof feature.id !== 'string' || !/^[a-z0-9_-]{1,64}$/i.test(feature.id) || !Array.isArray(c)
      || typeof p?.mag !== 'number' || p.mag < 2.5 || !Number.isFinite(p.time) || p.time > now + 60000
      || now - p.time > 86400000 || !Number.isFinite(c[0]) || !Number.isFinite(c[1])
      || Math.abs(c[0]) > 180 || Math.abs(c[1]) > 90) return [];
    return [{ id: `usgs-${feature.id}`, title: `M${p.mag.toFixed(1)} ${String(p.place || '').slice(0, 160)}`,
      magnitude: p.mag, occurredAt: p.time, lat: c[1], lon: c[0], provider: 'USGS',
      sourceUrl: `https://earthquake.usgs.gov/earthquakes/eventpage/${feature.id}`, kind: 'earthquake' }];
  }).sort((a, b) => b.occurredAt - a.occurredAt).slice(0, 100);
}
export async function connectFeeds(request, env, url) {
  if (!['/api/world-connect/news', '/api/alerts', '/api/account/config'].includes(url.pathname)) return null;
  if (request.method !== 'GET') return reply({ error: 'method-not-allowed' }, 405);
  if (url.pathname === '/api/account/config') return reply({ configured: Boolean(env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY),
    url: env.SUPABASE_URL || null, publishableKey: env.SUPABASE_PUBLISHABLE_KEY || null });
  if (url.pathname.endsWith('/news')) return cachedProvider('economy-rss', '한국경제 RSS', 300000, async () => {
    const r = await upstream(NEWS, { headers: { accept: 'application/xml,text/xml', 'user-agent': 'GODsEyeView/1.0' } });
    if (!r.ok) return failure('한국경제 RSS', r.status, `경제 뉴스 HTTP ${r.status}`, 300);
    return reply({ articles: newsFromRss(await r.text()), checkedAt: Date.now(), sourceUrl: NEWS });
  });
  return cachedProvider('alerts-feed', 'USGS / KMA', 60000, async () => {
    const r = await upstream(USGS); if (!r.ok) return failure('USGS', r.status, `지진 피드 HTTP ${r.status}`);
    const alerts = currentEarthquakes(await r.json());
    let domestic = { status: 'unavailable', error: '국내 지진 공급원 연결 실패', sourceUrl: KMA };
    try {
      const kr = await upstream(KMA, {}, 5000);
      if (kr.ok) {
        const dates = parseFeed(await kr.text()).map(row => Date.parse(String(row.pubDate))).filter(Number.isFinite);
        const newest = dates.length ? Math.max(...dates) : null;
        // This public RSS currently serves historical notices, not today's local feed.
        domestic = { status: 'stale', newestAt: newest, sourceUrl: KMA,
          error: '기상청 공개 RSS의 최신성이 검증되지 않았습니다. 국내 소규모 지진은 기상청 공식 발표를 확인하세요.' };
      }
    } catch { /* retain explicit domestic source failure, not synthetic alerts */ }
    return reply({ alerts, checkedAt: Date.now(), domestic, pollAfterSeconds: 60,
      limitations: '서비스 관측 알림이며 재난문자·지진 조기경보를 대체하지 않습니다. 2차 피해 구역을 예측하지 않습니다.' });
  });
}
