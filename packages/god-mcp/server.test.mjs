import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createResearchGraph } from '../god-flow/graph.js';

test('MCP v2 stdio negotiates, lists tools and validates a graph', { timeout: 15000 }, async () => {
  const child = spawn(process.execPath, ['packages/god-mcp/server.mjs'], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  const pending = new Map(); let next = 1, stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk.toString(); });
  const lines = createInterface({ input: child.stdout });
  lines.on('line', line => { const data = JSON.parse(line); pending.get(data.id)?.(data); });
  const call = (method, params) => { const id = next++; return new Promise(resolve => { pending.set(id, resolve);
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`); }); };
  try {
    const init = await call('initialize', { protocolVersion: '2026-07-28', capabilities: {}, clientInfo: { name: 'god-flow-test', version: '1.0' } });
    assert.equal(init.result.serverInfo.name, 'gods-eye-tools', stderr);
    child.stdin.write('{"jsonrpc":"2.0","method":"notifications/initialized"}\n');
    const list = await call('tools/list', {});
    assert.equal(list.result.tools.length, 6);
    const valid = await call('tools/call', { name: 'flow_validate', arguments: { workflow: JSON.stringify(createResearchGraph('test')) } });
    assert.notEqual(valid.result.isError, true);
    assert.equal(JSON.parse(valid.result.content[0].text).nodes.length, 4);
    const denied = await call('tools/call', { name: 'workflow_read', arguments: { name: '../../.env' } });
    assert.equal(denied.result.isError, true);
  } finally { lines.close(); child.stdin.end(); child.kill(); }
});
