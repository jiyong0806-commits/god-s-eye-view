const cache = new Map();
export async function searchWikipedia(query, { signal, fetcher = fetch } = {}) {
  const text = query.trim().slice(0, 200);
  if (!text) throw new Error('검색어를 입력하세요.');
  const language = /[가-힣]/.test(text) ? 'ko' : 'en';
  const key = `${language}:${text}`;
  const cached = cache.get(key);
  if (cached?.expires > Date.now()) return cached.value;
  const url = new URL(`https://${language}.wikipedia.org/w/api.php`);
  url.search = new URLSearchParams({ action: 'query', list: 'search', srsearch: text, srlimit: '5', format: 'json', utf8: '1' });
  const response = await fetcher(url, { signal, headers: { accept: 'application/json',
    'user-agent': 'GodsEyeView/1.0 (https://godseyeview.jiyong0806.chatgpt.site)' } });
  if (!response.ok) throw new Error(`Wikipedia 검색 HTTP ${response.status}`);
  const body = await response.json();
  if (!Array.isArray(body.query?.search)) throw new Error('검색 공급자 응답 형식이 올바르지 않습니다.');
  const sources = body.query.search.map(row => ({ title: String(row.title).slice(0, 160),
    url: `https://${language}.wikipedia.org/?curid=${Number(row.pageid)}`,
    snippet: String(row.snippet || '').replace(/<[^>]*>/g, '').slice(0, 700) }));
  const value = { query: text, provider: 'Wikipedia', sources, fetchedAt: new Date().toISOString(),
    text: sources.length ? sources.map((row, i) => `[${i + 1}] ${row.title}\n${row.snippet}\n${row.url}`).join('\n\n') : `"${text}"의 백과사전 검색 결과가 없습니다. 더 짧은 주제어로 다시 검색하세요.` };
  if (cache.size >= 32) cache.delete(cache.keys().next().value);
  cache.set(key, { value, expires: Date.now() + 300000 });
  return value;
}
