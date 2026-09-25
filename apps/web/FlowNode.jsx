import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ArrowDownToLine, BrainCircuit, Search, FileText, Check, CircleAlert, LoaderCircle, Circle } from 'lucide-react';
export const NODE_META = {
  input: { label: '사용자 요청', english: 'INPUT', Icon: ArrowDownToLine },
  search: { label: '인터넷 검색', english: 'SEARCH', Icon: Search },
  ai: { label: '분석 · 아이디어', english: 'AI', Icon: BrainCircuit },
  output: { label: '결과', english: 'OUTPUT', Icon: FileText },
};
const STATES = { idle: '대기', running: '실행 중', success: '완료', error: '실패' };
const STATUS_ICONS = { idle: Circle, running: LoaderCircle, success: Check, error: CircleAlert };
export function NodeContent({ node, result, mobile = false, selected = false }) {
  const { label, english, Icon } = NODE_META[node.type];
  const status = result?.status || 'idle';
  const StatusIcon = STATUS_ICONS[status];
  const value = result?.value;
  const text = result?.error || value?.text || (node.type === 'input' ? node.config.text : node.type === 'ai' ? node.config.instruction : '');
  return <article className={`flow-node ${selected ? 'selected' : ''}`} data-state={status} data-kind={node.type} aria-label={`${label}: ${STATES[status]}`}>
    {!mobile && node.input.length > 0 && <Handle type="target" position={Position.Left} id="in" aria-label={`${label} 입력 연결`} />}
    <header className="node-drag"><span className="node-symbol"><Icon size={20} strokeWidth={1.5} /></span>
      <div><span className="node-type">{english}</span><h2>{label}</h2></div>
      <StatusIcon className={`state-icon ${status === 'running' ? 'spin' : ''}`} size={17} aria-label={STATES[status]} />
    </header>
    <div className="node-body nodrag nowheel"><p>{text || (node.type === 'search' ? 'Wikipedia' : '실행 결과 대기')}</p>
      {value?.sources?.length > 0 && <ul className="sources">{value.sources.map((source, i) => /^https:\/\//.test(source.url) &&
        <li key={`${source.url}-${i}`}><a href={source.url} target="_blank" rel="noopener noreferrer">[{i + 1}] {source.title || '출처'}</a></li>)}</ul>}
    </div>
    <footer><span>{value?.provider || (node.type === 'ai' ? '로컬 모델' : STATES[status])}</span>
      <span>{result?.durationMs != null ? `${(result.durationMs / 1000).toFixed(1)}s` : '—'}</span></footer>
    {!mobile && node.output.length > 0 && <Handle type="source" position={Position.Right} id="out" aria-label={`${label} 출력 연결`} />}
  </article>;
}
export const FlowNode = memo(({ data, selected }) => <NodeContent node={data.node} result={data.result} selected={selected} />);
