import { flowRoutes } from '../../worker/flowRoutes.js';

export function godFlowDevPlugin() {
  return { name: 'god-flow-routes', configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (url.pathname.startsWith('/api/flow/')) {
        try {
          const request = new Request(url, { method: req.method, headers: req.headers,
            ...(!['GET', 'HEAD'].includes(req.method) ? { body: req, duplex: 'half' } : {}) });
          const response = await flowRoutes(request, { FLOW_LOCAL_RUNTIME: '1', OLLAMA_MODEL: process.env.OLLAMA_MODEL || 'qwen3:1.7b' });
          res.writeHead(response.status, Object.fromEntries(response.headers));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch { res.writeHead(502, { 'content-type': 'application/json' }); res.end('{"error":"Local runtime error"}'); }
        return;
      }
      if (url.pathname === '/' || url.pathname === '/home' || url.pathname === '/home/') req.url = `/home/index.html${url.search}`;
      if (url.pathname === '/map' || url.pathname === '/map/') req.url = `/index.html${url.search}`;
      next();
    });
  } };
}
