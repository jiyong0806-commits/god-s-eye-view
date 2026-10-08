// A publishable key identifies the shared project; RLS protects account data.
export const PLASMA_ACCOUNT = Object.freeze({
  url: 'https://jjmkhfqxzvhlblmgljwp.supabase.co',
  publishableKey: 'sb_publishable_ycjpP17Icwo7Nfw4Ont5-g_I6QePfcH',
});

export function publicAccountConfig(env = {}) {
  const configured = env.SUPABASE_URL !== undefined || env.SUPABASE_PUBLISHABLE_KEY !== undefined;
  const url = configured ? env.SUPABASE_URL : PLASMA_ACCOUNT.url;
  const key = configured ? env.SUPABASE_PUBLISHABLE_KEY : PLASMA_ACCOUNT.publishableKey;
  const valid = /^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(url || '') && /^sb_publishable_[A-Za-z0-9_-]+$/.test(key || '');
  return { configured: valid, url: valid ? url : null, publishableKey: valid ? key : null };
}

export function safeAccountReturn(value, fallback = '/map/') {
  if (typeof value !== 'string' || value.length > 4096 || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const url = new URL(value, 'https://plasma.invalid');
    if (url.origin !== 'https://plasma.invalid' || !['/', '/map', '/map/', '/home', '/home/', '/app', '/app/', '/mobile.html'].includes(url.pathname)) return fallback;
    for (const name of [...url.searchParams.keys()]) if (/token|code|password|secret|session/i.test(name)) url.searchParams.delete(name);
    if (!url.hash.startsWith('#v=')) url.hash = '';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return fallback; }
}
