import { spawn } from 'node:child_process';

// Read the short-lived, project-scoped upload token without echoing or saving it.
const cli = process.argv[2];
if (!cli) throw new Error('Pass the installed Wrangler CLI path');
process.stdin.setRawMode?.(true);
process.stdin.setEncoding('utf8');
process.stdin.resume();
console.log('Ready for project upload authorization on stdin');
let input = '';
process.stdin.on('data', function receive(chunk) {
  if (chunk.includes('\u0003')) process.exit(130);
  input += chunk;
  if (!/[\r\n]/.test(input)) return;
  process.stdin.removeListener('data', receive);
  process.stdin.setRawMode?.(false);
  process.stdin.pause();
  const jwt = input.trim();
  input = '';
  const child = spawn(process.execPath, [cli, 'pages', 'project', 'upload', 'dist/pages',
    '--output-manifest-path', 'output/pages-asset-manifest.json'], {
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, CF_PAGES_UPLOAD_JWT: jwt, CLOUDFLARE_API_TOKEN: jwt, WRANGLER_SEND_METRICS: 'false' },
  });
  child.on('error', () => { console.error('Unable to start Wrangler'); process.exit(1); });
  child.on('exit', code => process.exit(code ?? 1));
});
