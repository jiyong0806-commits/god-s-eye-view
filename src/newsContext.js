export function newsMatches(article, { terms = [], mapTerms = [] } = {}) {
  const title = String(article.title || '').normalize('NFKC').toLowerCase();
  const match = values => [...new Set(values.filter(value => typeof value === 'string' && value.length > 1
    && title.includes(value.normalize('NFKC').toLowerCase())))].slice(0, 8);
  return { personal: match(terms), map: match(mapTerms) };
}

export function newsBrief(article) {
  return {
    text: `${article.provider}의 경제 보도 제목: ${article.title}`,
    scope: '공식 RSS에 제공된 제목·발행 시각만 확인했습니다. 기사 본문 요약이나 독립 사실 검증은 아닙니다.',
    assessment: /[“”"「」]|전망|예상|주장|우려|가능성/.test(article.title)
      ? '제목에 인용·전망 표현이 포함됩니다. 발언이나 예측을 확정된 사실로 해석하지 않습니다.'
      : '제목의 보도 내용을 전달하며 사실 확정·찬반 평가·투자 판단을 하지 않습니다.',
  };
}

export function newsAnswer(article, question) {
  const q = String(question || '').trim();
  let text;
  if (/출처|근거|source|evidence/i.test(q)) text = `출처는 ${article.provider} 공식 RSS입니다. 발행 시각과 기사 링크만 확인됐으며 독립 검증 자료는 없습니다.`;
  else if (/언제|날짜|시각|when/i.test(q)) text = `RSS에 기재된 발행 시각은 ${new Date(article.publishedAt).toISOString()}입니다. 사건이 일어난 시각이나 기사 수정 시각과 같다고 단정할 수 없습니다.`;
  else if (/왜|원인|영향|피해|예측|투자|수익|사실|중립|why|impact|predict/i.test(q)) text = '현재 RSS에는 기사 본문·인과 근거·독립 검증이 없습니다. 원인, 영향, 사실 여부나 전망을 추측해 답하지 않습니다.';
  else if (/요약|무슨|어떤|내용|핵심|summary|what/i.test(q)) text = `${newsBrief(article).text}\n${newsBrief(article).scope}`;
  else text = '확인 가능한 것은 제목, 발행 시각, 출처입니다. 기사 본문이나 다른 매체의 근거가 필요한 질문에는 아직 답할 수 없습니다.';
  return { mode: 'source-lookup', provider: article.provider, text, sourceUrl: article.url,
    sourceId: article.sourceId, evidenceScope: 'rss-title-and-publication-time', generatedByAI: false };
}
