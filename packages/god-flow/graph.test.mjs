import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createResearchGraph, createNode, validateGraph, resolveOrder, importGraph, exportGraph, canConnect } from './graph.js';
import { executeGraph } from '../god-runtime/executor.js';
import { createToolRouter } from '../god-runtime/router.js';

test('graph round trip preserves structure, resets forged status, drops unknown config', () => {
  const graph = createResearchGraph('음악 앱'); graph.nodes[0].status = 'success'; graph.nodes[0].config.secret = 'not exported';
  const restored = importGraph(exportGraph(graph));
  assert.equal(restored.nodes[0].status, 'idle'); assert.equal(restored.nodes[0].config.secret, undefined);
  assert.deepEqual(resolveOrder(restored).order, ['input', 'search', 'ai', 'output']);
});
test('rejects cycles, dangling edges, duplicate IDs, forged ports and oversized imports', () => {
  const g = createResearchGraph('x');
  assert.equal(canConnect(g, { source: 'ai', target: 'search', sourceHandle: 'out', targetHandle: 'in' }), false);
  assert.throws(() => validateGraph({ ...g, nodes: [...g.nodes, g.nodes[0]] }));
  assert.throws(() => validateGraph({ ...g, edges: [{ id: 'x', source: 'missing', target: 'search' }] }));
  const bad = structuredClone(g); bad.nodes[0].output = [{ id: 'shell', type: 'code' }];
  assert.throws(() => validateGraph(bad)); assert.throws(() => importGraph(' '.repeat(262145)));
});
test('executes real dependency results through all four node types', async () => {
  const events = [];
  const router = createToolRouter({ search: async ({ query }) => ({ text: `근거: ${query}`, sources: [{ url: 'https://example.org' }], provider: 'test' }),
    ai: async ({ text }) => ({ text: `분석: ${text}`, provider: 'test model' }) });
  const result = await executeGraph(createResearchGraph('음악 앱'), { router, onEvent: e => events.push(e) });
  assert.equal(result.ok, true); assert.equal(result.results.output.value.text, '분석: 근거: 음악 앱');
  assert.deepEqual(events.filter(e => e.status === 'running').map(e => e.id), ['input', 'search', 'ai', 'output']);
});
test('failure blocks descendants, still executes independent nodes', async () => {
  const g = createResearchGraph('x'); g.nodes.push(createNode('input', { x: 0, y: 400 }, 'independent'));
  const visited = [];
  const result = await executeGraph(g, { router: async node => { visited.push(node.id); if (node.type === 'search') throw new Error('HTTP 429'); return { text: 'ok' }; } });
  assert.equal(result.ok, false); assert.equal(result.results.search.error, 'HTTP 429');
  assert.equal(visited.includes('ai'), false); assert.equal(result.results.independent.ok, true);
});
test('timeout and cancel settle even if a tool ignores its signal', async () => {
  const result = await executeGraph(createResearchGraph('x'), { router: () => new Promise(() => {}), timeoutMs: 15 });
  assert.match(result.results.input.error, /초과/);
  const controller = new AbortController(); controller.abort();
  const aborted = await executeGraph(createResearchGraph('x'), { signal: controller.signal, router: () => assert.fail('must not call tool') });
  assert.equal(aborted.cancelled, true); assert.equal(Object.keys(aborted.results).length, 4);
});
test('queue concurrency never exceeds configured budget', async () => {
  const g = { version: 1, name: 'parallel', nodes: Array.from({ length: 8 }, (_, i) => createNode('input', { x: i, y: 0 }, `n${i}`)), edges: [] };
  let active = 0, max = 0;
  await executeGraph(g, { concurrency: 2, router: async () => { active++; max = Math.max(max, active); await new Promise(r => setTimeout(r, 5)); active--; return { text: 'ok' }; } });
  assert.equal(max, 2);
});
