export const NODE_TYPES = Object.freeze(['input', 'search', 'ai', 'output']);
export const LIMITS = Object.freeze({ nodes: 64, edges: 192, bytes: 262144, text: 12000 });
const ID = /^[a-zA-Z0-9_-]{1,80}$/;
const fail = message => { throw new Error(message); };

export function createNode(type, position = { x: 0, y: 0 }, id = crypto.randomUUID()) {
  if (!NODE_TYPES.includes(type)) fail('지원하지 않는 노드입니다.');
  return { id, type, position, status: 'idle',
    input: type === 'input' ? [] : [{ id: 'in', type: 'text' }],
    output: type === 'output' ? [] : [{ id: 'out', type: 'text' }],
    config: type === 'ai' ? { instruction: '자료의 근거와 한계를 구분하고, 핵심 분석과 실행 가능한 아이디어를 한국어로 정리하세요.' } : { text: '' } };
}

export function createResearchGraph(text = '') {
  const nodes = NODE_TYPES.map((type, i) => createNode(type, { x: i * 340, y: 40 }, type));
  nodes[0].config.text = text;
  return { version: 1, name: '새로운 리서치', nodes,
    edges: nodes.slice(1).map((node, i) => ({ id: `edge-${i}`, source: nodes[i].id,
      target: node.id, sourceHandle: 'out', targetHandle: 'in' })) };
}

export function validateGraph(raw) {
  if (!raw || raw.version !== 1 || !Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) fail('God Flow v1 파일이 아닙니다.');
  if (!raw.nodes.length || raw.nodes.length > LIMITS.nodes || raw.edges.length > LIMITS.edges) fail('노드 또는 연결 개수 한도를 초과했습니다.');
  const nodes = raw.nodes.map(node => {
    if (!ID.test(node?.id) || !NODE_TYPES.includes(node?.type)) fail('노드 ID 또는 종류가 올바르지 않습니다.');
    if (!Number.isFinite(node.position?.x) || !Number.isFinite(node.position?.y) ||
        Math.abs(node.position.x) > 100000 || Math.abs(node.position.y) > 100000) fail('노드 위치가 올바르지 않습니다.');
    const clean = createNode(node.type, { x: node.position.x, y: node.position.y }, node.id);
    for (const direction of ['input', 'output']) {
      if (!Array.isArray(node[direction]) || JSON.stringify(node[direction]) !== JSON.stringify(clean[direction])) fail('노드 포트 규격이 일치하지 않습니다.');
    }
    const field = node.type === 'ai' ? 'instruction' : 'text';
    const value = node.config?.[field] ?? '';
    if (typeof value !== 'string' || value.length > LIMITS.text) fail('노드 입력이 너무 길거나 올바르지 않습니다.');
    clean.config[field] = value;
    return clean;
  });
  const byId = new Map(nodes.map(n => [n.id, n]));
  if (byId.size !== nodes.length) fail('중복된 노드 ID입니다.');
  const ids = new Set(), pairs = new Set();
  const edges = raw.edges.map(edge => {
    const source = byId.get(edge?.source), target = byId.get(edge?.target);
    if (!ID.test(edge?.id) || ids.has(edge.id) || !source || !target || source === target) fail('유효하지 않은 연결입니다.');
    if (edge.sourceHandle !== 'out' || edge.targetHandle !== 'in' || !source.output.length || !target.input.length) fail('입출력 방향이 맞지 않습니다.');
    const pair = `${source.id}:${target.id}`;
    if (pairs.has(pair)) fail('같은 노드 사이의 중복 연결입니다.');
    ids.add(edge.id); pairs.add(pair);
    return { id: edge.id, source: source.id, target: target.id, sourceHandle: 'out', targetHandle: 'in' };
  });
  const graph = { version: 1, name: typeof raw.name === 'string' ? raw.name.slice(0, 80) : '새로운 리서치', nodes, edges };
  resolveOrder(graph);
  return graph;
}

export function resolveOrder({ nodes, edges }) {
  const incoming = new Map(nodes.map(node => [node.id, []]));
  const outgoing = new Map(nodes.map(node => [node.id, []]));
  for (const edge of edges) {
    if (!incoming.has(edge.target) || !outgoing.has(edge.source)) fail('연결된 노드가 없습니다.');
    incoming.get(edge.target).push(edge.source);
    outgoing.get(edge.source).push(edge.target);
  }
  const counts = new Map([...incoming].map(([id, rows]) => [id, rows.length]));
  const queue = nodes.filter(n => counts.get(n.id) === 0).map(n => n.id);
  const order = [];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]; order.push(id);
    for (const child of outgoing.get(id)) {
      counts.set(child, counts.get(child) - 1);
      if (counts.get(child) === 0) queue.push(child);
    }
  }
  if (order.length !== nodes.length) fail('순환 연결은 실행할 수 없습니다.');
  return { order, incoming, outgoing };
}

export function importGraph(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > LIMITS.bytes) fail('파일은 256KB 이하여야 합니다.');
  return validateGraph(JSON.parse(text));
}
export function exportGraph(graph) { return JSON.stringify(validateGraph(graph), null, 2); }

export function canConnect(graph, connection) {
  try {
    validateGraph({ ...graph, edges: [...graph.edges, { ...connection, id: 'candidate-connection' }] });
    return true;
  } catch { return false; }
}
