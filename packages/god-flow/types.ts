export type NodeType = 'input' | 'search' | 'ai' | 'output';
export interface Port { id: string; type: 'text' }
export interface GodNode {
  id: string;
  type: NodeType;
  input: Port[];
  output: Port[];
  status: 'idle' | 'running' | 'success' | 'error';
  config: Record<string, unknown>;
  position: { x: number; y: number };
}
export interface GodEdge { id: string; source: string; target: string; sourceHandle: string; targetHandle: string }
export interface GodGraph { version: 1; name: string; nodes: GodNode[]; edges: GodEdge[] }
