import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(path.join(root, 'wrangler.pages.jsonc'), 'utf8'));
const directory = path.join(root, 'output/cloudflare-pages-deploy');
if (!existsSync(path.join(root, 'dist/pages/_worker.js'))) throw new Error('Build Pages before deploying');
mkdirSync(directory, { recursive: true });
config.pages_build_output_dir = '../../dist/pages';
for (const database of config.d1_databases || []) database.migrations_dir = '../../migrations';
writeFileSync(path.join(directory, 'wrangler.jsonc'), JSON.stringify(config, null, 2));
// Pages requires the standard config filename discovered from its working directory.
const args = ['wrangler@4.136.3', 'pages', 'deploy', '../../dist/pages', '--project-name', 'godseyeview', '--branch', 'main'];
const result = process.platform === 'win32'
  ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `npx ${args.join(' ')}`], { cwd: directory, stdio: 'inherit' })
  : spawnSync('npx', args, { cwd: directory, stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
