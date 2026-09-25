import { spawn } from 'node:child_process';
import { openSync, closeSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const binary = path.join(root, '.gev-cache/ollama/runtime/ollama.exe');
if (!existsSync(binary)) throw new Error('Run setup-local-ai and extract the verified archive first.');
const current = await fetch('http://127.0.0.1:11434/api/version', { signal: AbortSignal.timeout(1000) }).catch(() => null);
if (current?.ok) {
  console.log('An existing Ollama service is available; it was not restarted.');
} else {
  mkdirSync(path.join(root, '.gev-logs'), { recursive: true });
  const log = openSync(path.join(root, '.gev-logs/ollama.log'), 'a');
  const child = spawn(binary, ['serve'], { cwd: root, windowsHide: true, detached: true,
    stdio: ['ignore', log, log], env: { ...process.env,
      OLLAMA_HOST: '127.0.0.1:11434', OLLAMA_MODELS: path.join(root, '.gev-cache/ollama/models'),
      OLLAMA_NUM_PARALLEL: '1', OLLAMA_MAX_LOADED_MODELS: '1', OLLAMA_KEEP_ALIVE: '2m',
      OLLAMA_MAX_QUEUE: '2', OLLAMA_NO_CLOUD: '1',
    } });
  child.on('error', error => { console.error(error.message); process.exitCode = 1; });
  child.unref(); closeSync(log);
  console.log(JSON.stringify({ pid: child.pid, address: '127.0.0.1:11434', persistentInstall: false }));
}
