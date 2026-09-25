import { flowRoutes } from './flowRoutes.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return await flowRoutes(request, env) || Response.json({ error: 'Unknown API route' }, { status: 404 });
    }
    if (['/', '/home', '/home/'].includes(url.pathname)) url.pathname = '/home/';
    return env.ASSETS.fetch(new Request(url, request));
  },
};
