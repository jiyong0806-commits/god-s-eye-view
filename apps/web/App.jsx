import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlow, ReactFlowProvider, Background, Controls, applyNodeChanges, applyEdgeChanges, useReactFlow } from '@xyflow/react';
import { ArrowUpRight, Copy, Download, FilePlus2, FolderOpen, Globe2, LayoutGrid, Play, Plus, Save, Square, Trash2 } from 'lucide-react';
import { createResearchGraph, createNode, canConnect, importGraph, LIMITS } from '../../packages/god-flow/graph.js';
import { executeGraph } from '../../packages/god-runtime/executor.js';
import { createHttpRouter } from '../../packages/god-runtime/router.js';
import { IconButton } from '../../packages/god-ui/IconButton.jsx';
import { FlowNode, NodeContent, NODE_META } from './FlowNode.jsx';
import { Inspector } from './Inspector.jsx';
import { loadSavedGraph, saveGraph, downloadGraph } from './persistence.js';
import { useAmbient, useMedia } from './useAmbient.js';
const nodeTypes = { god: FlowNode };
const fitOptions = { padding: 0.15, maxZoom: 1 };
const mapUrl = import.meta.env.VITE_MAP_URL || '/map/';

function Workspace() {
  const [graph, setGraph] = useState(() => { try { return loadSavedGraph() || createResearchGraph(); } catch { return createResearchGraph(); } });
  const [prompt, setPrompt] = useState(() => graph.nodes.find(n => n.type === 'input')?.config.text || '');
  const [results, setResults] = useState({});
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [adding, setAdding] = useState(false);
  const [capability, setCapability] = useState(null);
  const fileRef = useRef(), abortRef = useRef(), busyRef = useRef(false), ambientRef = useRef();
  const mounted = useRef(true);
  const mobile = useMedia('(max-width: 760px)');
  const flow = useReactFlow();
  useAmbient(ambientRef);
  useEffect(() => { mounted.current = true; const controller = new AbortController();
    fetch('/api/flow/status', { signal: controller.signal }).then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setCapability).catch(e => { if (e.name !== 'AbortError') setCapability({ ai: { reason: '서버 연결 확인 실패' } }); });
    return () => { mounted.current = false; controller.abort(); abortRef.current?.abort(); };
  }, []);
  const current = graph.nodes.find(n => n.id === selected);
  const nodes = useMemo(() => graph.nodes.map(node => ({ id: node.id, type: 'god', position: node.position,
    selected: node.id === selected, dragHandle: '.node-drag', data: { node, result: results[node.id] } })), [graph.nodes, results, selected]);
  const edges = useMemo(() => graph.edges.map(edge => ({ ...edge, selected: edge.id === selectedEdge,
    style: { stroke: results[edge.source]?.status === 'success' ? '#64d8c5' : '#657380', strokeWidth: 1.5 } })), [graph.edges, results, selectedEdge]);
  const edit = useCallback(fn => { if (busyRef.current) return; setGraph(fn); setResults({}); setMessage(''); }, []);
  const onNodesChange = useCallback(changes => {
    if (busyRef.current) return;
    const moving = changes.filter(c => c.type === 'position' || c.type === 'remove');
    if (!moving.length) return;
    setGraph(g => { const updated = applyNodeChanges(moving, g.nodes); const ids = new Set(updated.map(n => n.id));
      return { ...g, nodes: updated, edges: g.edges.filter(e => ids.has(e.source) && ids.has(e.target)) }; });
    if (moving.some(c => c.type === 'remove')) setResults({});
  }, []);
  const onEdgesChange = useCallback(changes => {
    if (busyRef.current) return;
    setGraph(g => ({ ...g, edges: applyEdgeChanges(changes, g.edges) }));
    if (changes.some(change => change.type === 'remove')) { setResults({}); setMessage(''); }
  }, []);
  const onConnect = useCallback(connection => edit(g => canConnect(g, connection)
    ? { ...g, edges: [...g.edges, { ...connection, id: crypto.randomUUID() }] } : g), [edit]);
  const remove = () => { edit(g => ({ ...g, nodes: g.nodes.filter(n => n.id !== selected),
    edges: g.edges.filter(e => e.id !== selectedEdge && e.source !== selected && e.target !== selected) })); setSelected(null); setSelectedEdge(null); };
  const duplicate = () => { if (!current || graph.nodes.length >= LIMITS.nodes) return;
    const node = { ...structuredClone(current), id: crypto.randomUUID(), status: 'idle', position: { x: current.position.x + 32, y: current.position.y + 280 } };
    edit(g => ({ ...g, nodes: [...g.nodes, node] })); setSelected(node.id); };
  const add = type => { if (graph.nodes.length >= LIMITS.nodes) { setMessage('노드는 최대 64개입니다.'); return; }
    const position = flow.screenToFlowPosition({ x: innerWidth / 2 - 140, y: innerHeight / 2 });
    const node = createNode(type, position); edit(g => ({ ...g, nodes: [...g.nodes, node] })); setSelected(node.id); setAdding(false); };
  const run = async event => {
    event?.preventDefault(); if (busyRef.current) return;
    if (!graph.nodes.length) { setMessage('실행할 노드를 추가하세요.'); return; }
    const firstInput = graph.nodes.find(n => n.type === 'input');
    const snapshot = { ...graph, nodes: graph.nodes.map(n => n.id === firstInput?.id ? { ...n, config: { text: prompt } } : n) };
    setGraph(snapshot); setResults({}); setMessage(''); busyRef.current = true; setRunning(true);
    const controller = new AbortController(); abortRef.current = controller;
    try {
      const report = await executeGraph(snapshot, { router: createHttpRouter(), signal: controller.signal, concurrency: 2,
        onEvent: event => { if (mounted.current) setResults(previous => ({ ...previous, [event.id]: event })); } });
      if (mounted.current) setMessage(report.cancelled ? '실행을 중지했습니다.' : report.ok ? '모든 단계가 완료되었습니다.' : '실패한 단계의 연결 상태를 확인하세요.');
    } catch (error) { if (mounted.current) setMessage(error.message); }
    finally { busyRef.current = false; if (mounted.current) setRunning(false); abortRef.current = null; }
  };
  const importFile = async event => { const file = event.target.files?.[0]; event.target.value = ''; if (!file || busyRef.current) return;
    try { if (file.size > LIMITS.bytes) throw new Error('파일은 256KB 이하여야 합니다.'); const next = importGraph(await file.text());
      if (busyRef.current || !mounted.current) return;
      setGraph(next); setPrompt(next.nodes.find(n => n.type === 'input')?.config.text || ''); setResults({}); setSelected(null); setSelectedEdge(null); setMessage('파일을 불러왔습니다.');
      requestAnimationFrame(() => flow.fitView(fitOptions));
    } catch (error) { setMessage(error.message); } };
  const save = () => { try { saveGraph(graph); setMessage('이 브라우저에 저장했습니다.'); } catch { setMessage('저장 공간을 사용할 수 없습니다. JSON 파일로 내보내세요.'); } };
  const reset = () => { if (busyRef.current) return; setGraph(createResearchGraph()); setPrompt(''); setSelected(null); setSelectedEdge(null); setResults({}); setMessage('새 워크플로'); requestAnimationFrame(() => flow.fitView(fitOptions)); };
  const completed = Object.values(results).filter(r => r.status === 'success').length;
  return <main className="god-app" ref={ambientRef}>
    <div className="space-backdrop" aria-hidden="true" /><div className="pointer-light" aria-hidden="true" />
    <header className="app-header"><a className="brand" href="/home/"><img src="/app-icon.png" alt="" /><h1>GOD'S EYE VIEW<small>PLASMA</small></h1></a>
      <nav aria-label="작업 공간"><span className="active-tab"><LayoutGrid size={16} /> God Flow</span><a href={mapUrl}><Globe2 size={16} /> 지구 관제 <ArrowUpRight size={14} /></a></nav>
    </header>
    <section className="command-area" aria-label="새로운 요청">
      <div className="command-heading"><span>WORKSPACE / 01</span><span>{mobile ? 'VIEW MODE' : 'GOD FLOW'}</span></div>
      <form className="command-input" onSubmit={run}>
        <label className="sr-only" htmlFor="request">조사할 주제 또는 명령</label>
        <input id="request" value={prompt} maxLength={12000} disabled={running} onChange={event => { const value = event.target.value; setPrompt(value);
          edit(g => { const first = g.nodes.find(n => n.type === 'input'); return { ...g, nodes: g.nodes.map(n => n.id === first?.id ? { ...n, config: { text: value } } : n) }; }); }}
          placeholder="무엇을 탐구할까요?" autoComplete="off" />
        {running ? <button type="button" className="run-button stop" onClick={() => abortRef.current?.abort()}><Square size={15} />중지</button> :
          <button className="run-button" type="submit"><Play size={16} /> <span>RUN FLOW</span></button>}
      </form>
      <div className="command-meta"><span>{capability?.search?.scope || '공급자 확인 중'}</span><span className={capability?.ai?.configured ? 'connected' : 'pending'}>{capability?.ai?.configured ? `로컬 모델 · ${capability.ai.model}` : capability?.ai?.reason || 'AI 연결 확인 중'}</span></div>
    </section>
    <section className="workflow-area" aria-label="워크플로">
      <div className="workspace-toolbar"><div><span className="workflow-title">{graph.name}</span><span className="node-count">{graph.nodes.length} nodes</span></div>
        <div className="tool-actions">
          {!mobile && <div className="add-menu"><IconButton label="노드 추가" disabled={running} aria-expanded={adding} onClick={() => setAdding(!adding)}><Plus size={18} /></IconButton>
            {adding && <div className="node-menu" role="menu">{Object.entries(NODE_META).map(([type, meta]) => <button key={type} role="menuitem" onClick={() => add(type)}><meta.Icon size={16} />{meta.english}</button>)}</div>}</div>}
          <IconButton label="새 워크플로" disabled={running} onClick={reset}><FilePlus2 size={18} /></IconButton>
          <IconButton label="브라우저에 저장" disabled={running || !graph.nodes.length} onClick={save}><Save size={18} /></IconButton>
          <IconButton label="JSON 불러오기" disabled={running} onClick={() => fileRef.current.click()}><FolderOpen size={18} /></IconButton>
          <IconButton label="JSON 내보내기" disabled={running || !graph.nodes.length} onClick={() => { try { downloadGraph(graph); } catch (e) { setMessage(e.message); } }}><Download size={18} /></IconButton>
          {!mobile && <><IconButton label="선택 노드 복제" disabled={running || !current} onClick={duplicate}><Copy size={18} /></IconButton>
            <IconButton label="선택 항목 삭제" disabled={running || (!selected && !selectedEdge)} onClick={remove}><Trash2 size={18} /></IconButton></>}
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={importFile} />
        </div>
      </div>
      <div className={`workspace-content ${current && !mobile ? 'with-inspector' : ''}`}>
        {mobile ? <div className="mobile-flow">{graph.nodes.map(node => <NodeContent key={node.id} node={node} result={results[node.id]} mobile />)}</div> :
          <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onConnect={onConnect} isValidConnection={connection => canConnect(graph, connection)}
            onNodeClick={(_, node) => { setSelected(node.id); setSelectedEdge(null); }} onEdgeClick={(_, edge) => { setSelected(null); setSelectedEdge(edge.id); }}
            onPaneClick={() => { setSelected(null); setSelectedEdge(null); setAdding(false); }}
            nodesDraggable={!running} nodesConnectable={!running} deleteKeyCode={running ? null : ['Backspace', 'Delete']}
            fitView fitViewOptions={fitOptions} minZoom={0.25} maxZoom={1.7} onlyRenderVisibleElements colorMode="dark">
            <Background color="#91a3b122" gap={28} size={1} /><Controls showInteractive={false} />
          </ReactFlow>}
        {!mobile && <Inspector node={current} result={results[selected]} disabled={running} onClose={() => setSelected(null)}
          onDuplicate={duplicate} onDelete={remove} onChange={(field, value) => { edit(g => ({ ...g, nodes: g.nodes.map(n => n.id === selected ? { ...n, config: { ...n.config, [field]: value } } : n) }));
            if (selected === graph.nodes.find(n => n.type === 'input')?.id) setPrompt(value); }} />}
      </div>
    </section>
    <footer className="status-bar"><div role="status" aria-live="polite">{running ? <><span className="running-indicator" />{completed} / {graph.nodes.length} 완료</> : message || '실행 대기'}</div>
      <a href="https://www.nasa.gov/image-article/earths-limb-or-horizon/" target="_blank" rel="noopener noreferrer">Earth imagery · NASA</a></footer>
  </main>;
}
export default function App() { return <ReactFlowProvider><Workspace /></ReactFlowProvider>; }
