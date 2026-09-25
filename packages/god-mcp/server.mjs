import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod/v4';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { importGraph } from '../god-flow/graph.js';
import { executeGraph } from '../god-runtime/executor.js';
import { createToolRouter } from '../god-runtime/router.js';
import { localModelChat } from '../god-runtime/ollama.js';
import { searchWikipedia } from '../../tools/search/wikipedia.js';
import { getRepository } from '../../tools/github/repository.js';
import { readWorkflow, createWorkflowFile } from '../../tools/files/workflows.js';

const root = path.resolve(fileURLToPath(new URL('../../output/workflows/', import.meta.url)));
const server = new McpServer({ name: 'gods-eye-tools', version: '0.1.0' });
const respond = async action => {
  try { return { content: [{ type: 'text', text: JSON.stringify(await action()) }] }; }
  catch (error) { return { isError: true, content: [{ type: 'text', text: String(error.message).slice(0, 500) }] }; }
};
const graphInput = z.object({ workflow: z.string().max(262144) });
server.registerTool('flow_validate', { description: 'Validate a God Flow DAG without running tools.', inputSchema: graphInput,
  annotations: { readOnlyHint: true } }, ({ workflow }) => respond(() => importGraph(workflow)));
server.registerTool('flow_run', { description: 'Run an explicit workflow using Wikipedia search and a local Ollama model. Never executes arbitrary code.', inputSchema: graphInput },
  ({ workflow }, extra) => respond(() => executeGraph(importGraph(workflow), { signal: extra.signal,
    router: createToolRouter({ search: ({ query, signal }) => searchWikipedia(query, { signal }),
      ai: input => localModelChat(input, { signal: input.signal, url: 'http://127.0.0.1:11434', model: process.env.OLLAMA_MODEL }) }) })));
server.registerTool('search_wikipedia', { description: 'Search public Wikipedia with source URLs.', inputSchema: z.object({ query: z.string().min(1).max(200) }),
  annotations: { readOnlyHint: true } }, ({ query }, extra) => respond(() => searchWikipedia(query, { signal: extra.signal })));
server.registerTool('github_repository', { description: 'Read public repository metadata and declared license.', inputSchema: z.object({ repository: z.string().max(180) }),
  annotations: { readOnlyHint: true } }, ({ repository }, extra) => respond(() => getRepository(repository, { signal: extra.signal })));
server.registerTool('workflow_read', { description: 'Read one JSON workflow from the app workflow directory only.', inputSchema: z.object({ name: z.string().max(85) }),
  annotations: { readOnlyHint: true } }, ({ name }) => respond(() => readWorkflow(root, name)));
server.registerTool('workflow_create', { description: 'Create a new workflow JSON file; existing files are never overwritten.',
  inputSchema: z.object({ name: z.string().max(85), workflow: z.string().max(262144) }) },
  ({ name, workflow }) => respond(() => createWorkflowFile(root, name, importGraph(workflow))));

await server.connect(new StdioServerTransport());
