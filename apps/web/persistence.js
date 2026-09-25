import { importGraph, exportGraph } from '../../packages/god-flow/graph.js';
const KEY = 'gev-god-flow-v1';
export function loadSavedGraph() { const text = localStorage.getItem(KEY); return text ? importGraph(text) : null; }
export function saveGraph(graph) { localStorage.setItem(KEY, exportGraph(graph)); }
export function downloadGraph(graph) {
  const url = URL.createObjectURL(new Blob([exportGraph(graph)], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'god-flow.json'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
