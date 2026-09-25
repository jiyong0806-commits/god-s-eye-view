import React from 'react';
import { Copy, Trash2, X } from 'lucide-react';
import { IconButton } from '../../packages/god-ui/IconButton.jsx';
import { NODE_META } from './FlowNode.jsx';
export function Inspector({ node, result, disabled, onChange, onDuplicate, onDelete, onClose }) {
  if (!node) return null;
  const field = node.type === 'ai' ? 'instruction' : 'text';
  return <aside className="inspector" aria-label="노드 설정">
    <div className="inspector-title"><h2>{NODE_META[node.type].label}</h2><IconButton label="노드 설정 닫기" onClick={onClose}><X size={18} /></IconButton></div>
    <div className="inspector-actions"><IconButton label="선택 노드 복제" disabled={disabled} onClick={onDuplicate}><Copy size={18} /></IconButton>
      <IconButton label="선택 노드 삭제" disabled={disabled} onClick={onDelete}><Trash2 size={18} /></IconButton></div>
    {node.type !== 'output' && <label className="field-label">{node.type === 'ai' ? '분석 지시' : node.type === 'search' ? '검색어 (비워두면 이전 결과)' : '요청 내용'}
      <textarea value={node.config[field]} disabled={disabled} maxLength={12000} onChange={e => onChange(field, e.target.value)} rows={6} /></label>}
    <section className="inspector-result"><h3>실행 기록</h3>
      <p>{result?.error || result?.value?.text || '아직 실행하지 않았습니다.'}</p></section>
  </aside>;
}
