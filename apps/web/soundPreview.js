import { readFile } from 'node:fs/promises';
import { SOUND_EVENTS } from '../../packages/god-ui/sounds.js';

// Deliberately dev-server-only; unlicensed originals never enter public/ or dist/.
export async function serveSoundPreview(req, res) {
  if (!req.url?.startsWith('/__sound-preview/')) return false;
  const host = new URL(`http://${req.headers.host}`).hostname;
  const name = new URL(req.url, 'http://localhost').pathname.slice('/__sound-preview/'.length);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(host) ||
      !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) ||
      !['GET', 'HEAD'].includes(req.method) || !SOUND_EVENTS.some(event => name === `${event}.mp3`)) {
    res.writeHead(403); res.end(); return true;
  }
  try {
    const data = await readFile(new URL(`../../.gev-cache/sound-preview/${name}`, import.meta.url));
    res.writeHead(200, { 'content-type': 'audio/mpeg', 'content-length': data.length, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(404); res.end(); }
  return true;
}
