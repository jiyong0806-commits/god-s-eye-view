import { validateGraph, resolveOrder } from '../god-flow/graph.js';

function limitedTask(execute, signal, timeoutMs) {
  const controller = new AbortController();
  let timer, abort;
  const stop = new Promise((_, reject) => {
    abort = () => { controller.abort(); reject(new Error('실행이 취소되었습니다.')); };
    signal?.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => { controller.abort(); reject(new Error('노드 응답 시간이 초과되었습니다.')); }, timeoutMs);
    if (signal?.aborted) abort();
  });
  return Promise.race([Promise.resolve().then(() => {
    if (controller.signal.aborted) throw new Error('실행이 취소되었습니다.');
    return execute(controller.signal);
  }), stop]).finally(() => { clearTimeout(timer); signal?.removeEventListener('abort', abort); });
}

export async function executeGraph(raw, { router, signal, onEvent = () => {}, concurrency = 2, timeoutMs = 90000 } = {}) {
  const graph = validateGraph(raw);
  const { order, incoming } = resolveOrder(graph);
  const byId = new Map(graph.nodes.map(node => [node.id, node]));
  const results = new Map(), pending = new Set(order), running = new Map();
  const emit = (id, status, extra = {}) => onEvent({ id, status, at: Date.now(), ...extra });
  graph.nodes.forEach(n => emit(n.id, 'idle'));
  const limit = Math.max(1, Math.min(4, Math.floor(concurrency) || 2));
  const start = id => {
    pending.delete(id);
    const node = byId.get(id), parents = incoming.get(id).map(parent => results.get(parent));
    const blocked = parents.some(result => !result.ok);
    const promise = (async () => {
      if (signal?.aborted || blocked) {
        const error = signal?.aborted ? '실행이 취소되었습니다.' : '이전 단계가 실패하여 실행하지 않았습니다.';
        results.set(id, { ok: false, error }); emit(id, 'error', { error }); return;
      }
      const startedAt = Date.now(); emit(id, 'running');
      try {
        const value = await limitedTask(childSignal => router(node, parents.map(p => p.value), { signal: childSignal }), signal, timeoutMs);
        if (signal?.aborted) throw new Error('실행이 취소되었습니다.');
        if (!value || typeof value.text !== 'string' || value.text.length > 50000) throw new Error('도구 응답 형식이 올바르지 않습니다.');
        results.set(id, { ok: true, value });
        emit(id, 'success', { value, durationMs: Date.now() - startedAt });
      } catch (cause) {
        const error = String(cause?.message || '실행 실패').slice(0, 500);
        results.set(id, { ok: false, error }); emit(id, 'error', { error, durationMs: Date.now() - startedAt });
      }
    })();
    running.set(id, promise);
    promise.finally(() => running.delete(id));
  };
  while (pending.size || running.size) {
    for (const id of pending) {
      if (running.size >= limit) break;
      if (incoming.get(id).every(parent => results.has(parent))) start(id);
    }
    if (running.size) await Promise.race(running.values());
  }
  return { ok: [...results.values()].every(row => row.ok), cancelled: Boolean(signal?.aborted), results: Object.fromEntries(results) };
}
