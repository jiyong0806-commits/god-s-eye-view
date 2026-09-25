import { mkdir, realpath, readFile, writeFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { importGraph, exportGraph } from '../../packages/god-flow/graph.js';

async function workflowPath(root, name, writing = false) {
  if (!/^[a-zA-Z0-9_-]{1,80}\.json$/.test(name)) throw new Error('워크플로 파일 이름만 허용됩니다.');
  await mkdir(root, { recursive: true });
  const base = await realpath(root), target = path.join(base, name);
  try { const stat = await lstat(target); if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('일반 파일만 허용됩니다.'); }
  catch (error) { if (error.code !== 'ENOENT' || !writing) throw error; }
  return target;
}
export async function readWorkflow(root, name) { return importGraph(await readFile(await workflowPath(root, name), 'utf8')); }
export async function createWorkflowFile(root, name, graph) {
  const text = exportGraph(graph);
  await writeFile(await workflowPath(root, name, true), text, { flag: 'wx', mode: 0o600 });
  return { name, bytes: Buffer.byteLength(text) };
}
