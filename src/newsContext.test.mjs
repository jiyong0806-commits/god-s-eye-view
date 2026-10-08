import test from 'node:test';
import assert from 'node:assert/strict';
import { newsBrief, newsAnswer, newsMatches } from './newsContext.js';
const article = { id: '123', title: '서울 기업 투자 전망', provider: '한국경제', publishedAt: Date.parse('2026-10-08T03:00:00Z'), url: 'https://www.hankyung.com/article/123', sourceId: 'hankyung-rss' };
test('brief separates publisher claims from verified facts and does not claim to summarize unseen text', () => {
  assert.match(newsBrief(article).scope, /본문 요약.*아닙니다/); assert.match(newsBrief(article).assessment, /확정된 사실/);
});
test('news questions disclose the evidence boundary and never invent causes or investment outcomes', () => {
  assert.match(newsAnswer(article, '영향이 뭔가요').text, /추측해 답하지/);
  assert.equal(newsAnswer(article, '요약').generatedByAI, false);
  assert.match(newsAnswer(article, '언제').text, /2026-10-08T03:00:00/);
  assert.equal(newsAnswer(article, '출처').sourceUrl, article.url);
});
test('news relevance requires explicit name matches, not imaginary incident locations', () => {
  assert.deepEqual(newsMatches(article, { terms: ['투자', '부여'], mapTerms: ['서울', '도쿄'] }), { personal: ['투자'], map: ['서울'] });
});
