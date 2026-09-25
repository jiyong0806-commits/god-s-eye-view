export function createToolRouter({ search, ai }) {
  return async (node, inputs, { signal }) => {
    const text = inputs.map(item => item.text).join('\n\n').slice(0, 24000);
    const sources = inputs.flatMap(item => item.sources || []).slice(0, 20);
    if (node.type === 'input') {
      if (!node.config.text.trim()) throw new Error('사용자 요청을 입력하세요.');
      return { text: node.config.text.trim(), provider: '사용자 입력', sources: [] };
    }
    if (!inputs.length) throw new Error('이전 노드를 연결하세요.');
    if (node.type === 'output') return { text, sources, provider: inputs.map(item => item.provider).filter(Boolean).join(' / ') };
    if (node.type === 'search') return search({ query: node.config.text.trim() || text, signal });
    if (node.type === 'ai') return ai({ text, sources, instruction: node.config.instruction, signal });
    throw new Error('등록되지 않은 도구입니다.');
  };
}

export function createHttpRouter(fetcher = fetch) {
  async function call(type, payload, signal) {
    const response = await fetcher(`/api/flow/${type}`, { method: 'POST', signal,
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
    return body;
  }
  return createToolRouter({ search: ({ query, signal }) => call('search', { query }, signal),
    ai: ({ text, sources, instruction, signal }) => call('ai', { text, sources, instruction }, signal) });
}
