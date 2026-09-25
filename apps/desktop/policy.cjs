const path = require('node:path');
const APP_ORIGIN = 'gev://app';
const API_ORIGIN = 'https://godseyeview-c6q.pages.dev';

function isAppUrl(value) {
  try { const url = new URL(value); return url.protocol === 'gev:' && url.host === 'app' && !url.username && !url.password; }
  catch { return false; }
}

function assetPath(root, raw) {
  if (!isAppUrl(raw)) return null;
  let name;
  try { name = decodeURIComponent(new URL(raw).pathname); } catch { return null; }
  if (name.includes('\0') || name.includes('\\') || name.includes(':')) return null;
  if (['/', '/map', '/map/'].includes(name)) name = '/index.html';
  if (['/home', '/home/'].includes(name)) name = '/home/index.html';
  if (name.endsWith('/')) name += 'index.html';
  const target = path.resolve(root, `.${name}`);
  const relative = path.relative(root, target);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? target : null;
}

module.exports = { APP_ORIGIN, API_ORIGIN, isAppUrl, assetPath };
