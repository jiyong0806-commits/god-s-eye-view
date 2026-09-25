import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const repos = ['applyinnovations/bifrost-model-router', 'Y0oshi/Project-Eyes-On', 'trmxvibs/NanoGPS',
  'DesusLove/IronSight', 'Yggdrasil-Environmental-Systems/HYDRO-CORE-OSIRIS_POYO-NOWCAST',
  'simplifaisoul/osiris', 'diegosouzapw/OmniRoute', 'freellms/awesome-freellm-apis'];
const root = path.resolve('output/upstream-review');
mkdirSync(root, { recursive: true });
const results = [];
async function get(url, maxBytes = 3 * 1024 * 1024) {
  const response = await fetch(url, { headers: { 'user-agent': 'GODSEYEVIEW-source-review', accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const chunks = []; let size = 0;
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > maxBytes) throw new Error('Download exceeds review size budget');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
for (const repo of repos) {
  const directory = path.join(root, repo.replace('/', '--'));
  mkdirSync(directory, { recursive: true });
  const result = { repo, url: `https://github.com/${repo}`, runtimeInstalled: false, scriptsExecuted: false };
  try {
    const metadata = JSON.parse(await get(`https://api.github.com/repos/${repo}`));
    result.license = metadata.license?.spdx_id || 'not-declared';
    result.description = metadata.description;
    result.defaultBranch = metadata.default_branch;
    const commit = JSON.parse(await get(`https://api.github.com/repos/${repo}/commits/${encodeURIComponent(metadata.default_branch)}`));
    result.commit = commit.sha;
    try {
      const readme = JSON.parse(await get(`https://api.github.com/repos/${repo}/readme?ref=${commit.sha}`));
      writeFileSync(path.join(directory, 'README-upstream.md'), Buffer.from(readme.content, 'base64'));
    } catch (error) { result.readmeError = error.message; }
    const archivePath = path.join(directory, `${commit.sha}.zip`);
    if (!existsSync(archivePath)) {
      const archive = await get(`https://codeload.github.com/${repo}/zip/${commit.sha}`, 100 * 1024 * 1024);
      writeFileSync(archivePath, archive);
      result.archiveBytes = archive.length;
      result.archiveSha256 = createHash('sha256').update(archive).digest('hex');
    }
    result.status = 'source-downloaded-not-executed';
  } catch (error) { result.status = 'unavailable'; result.reason = error.message; }
  results.push(result);
  console.log(JSON.stringify(result));
  writeFileSync(path.join(root, 'review-manifest.json'), JSON.stringify(results, null, 2));
}
