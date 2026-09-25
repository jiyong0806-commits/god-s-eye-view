import backend from './index.js';

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    if (['/', '/map', '/map/', '/home', '/home/'].includes(url.pathname)) {
      // Pages redirects explicit index.html URLs; fetch the canonical asset path.
      url.pathname = url.pathname.startsWith('/home') ? '/home/' : '/';
      const asset = await env.ASSETS.fetch(new Request(url, request));
      const headers = new Headers(asset.headers);
      headers.set('cache-control', 'no-cache');
      return new Response(asset.body, { status: asset.status, headers });
    }
    if (url.pathname.startsWith('/api/')) {
      return backend.fetch(request, env, context);
    }
    const response = await env.ASSETS.fetch(request);
    // Pages SPA fallback must not impersonate missing fonts, scripts or images.
    const assetRequest = /\.(?:woff2?|ttf|png|jpe?g|webp|svg|gif|ico|js|mjs|css|wasm|json|glb|mp3|webm)$/i.test(url.pathname);
    if (assetRequest && response.headers.get('content-type')?.includes('text/html')) {
      return new Response('Asset not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
    }
    return response;
  },
};
