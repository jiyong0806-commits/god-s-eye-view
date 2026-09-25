const { app, BrowserWindow, Menu, protocol, net, session, dialog } = require('electron');
const { existsSync, mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { APP_ORIGIN, API_ORIGIN, isAppUrl, assetPath } = require('./policy.cjs');

protocol.registerSchemesAsPrivileged([{ scheme: 'gev', privileges: {
  standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true,
} }]);
app.enableSandbox();
const smoke = process.argv.includes('--smoke-test');
const qaDir = process.env.GEV_QA_DIR;
if (smoke && (!qaDir || !path.isAbsolute(qaDir))) throw new Error('GEV_QA_DIR must be an absolute local output directory.');
if (smoke) app.setPath('userData', path.join(qaDir, 'profile'));
let window;

async function route(request, root) {
  if (!isAppUrl(request.url)) return new Response('Forbidden', { status: 403 });
  if (request.initiatorOrigin && request.initiatorOrigin !== APP_ORIGIN) return new Response('Forbidden', { status: 403 });
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) {
    if (!['GET', 'POST'].includes(request.method)) return new Response('Method not allowed', { status: 405 });
    try {
      const headers = new Headers({ accept: request.headers.get('accept') || 'application/json', origin: API_ORIGIN });
      const contentType = request.headers.get('content-type');
      if (contentType) headers.set('content-type', contentType);
      const body = request.method === 'POST' ? await request.arrayBuffer() : undefined;
      if (body?.byteLength > 65536) return new Response('Request too large', { status: 413 });
      const response = await net.fetch(`${API_ORIGIN}${url.pathname}${url.search}`, {
        method: request.method, headers, body, redirect: 'error', credentials: 'omit',
        signal: AbortSignal.timeout(30000),
      });
      return response;
    } catch { return Response.json({ error: 'Public API connection failed', provider: 'GOD\'S EYE VIEW', status: 'unavailable' }, { status: 502 }); }
  }
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405 });
  const file = assetPath(root, request.url);
  if (!file || !existsSync(file)) return new Response('Not found', { status: 404 });
  const response = await net.fetch(pathToFileURL(file).href);
  const headers = new Headers(response.headers);
  headers.set('x-content-type-options', 'nosniff');
  if (file.endsWith('.html')) headers.set('content-security-policy',
    "default-src 'self' https: data: blob:; script-src 'self' blob: https://cdn.jsdelivr.net https://unpkg.com 'wasm-unsafe-eval'; style-src 'self' https: 'unsafe-inline'; object-src 'none'; base-uri 'self'; frame-src https:; worker-src 'self' blob:");
  return new Response(request.method === 'HEAD' ? null : response.body, { status: response.status, headers });
}

async function createWindow() {
  const root = app.isPackaged ? path.join(process.resourcesPath, 'web') : path.resolve(__dirname, '../../dist/client');
  if (!existsSync(path.join(root, 'index.html'))) throw new Error('Build the web application before starting the desktop app.');
  protocol.handle('gev', request => route(request, root));
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback) => {
    if (smoke || !isAppUrl(contents.getURL()) || permission !== 'media') return callback(false);
    dialog.showMessageBox(window, { type: 'question', title: 'Microphone', message: 'Allow microphone access for voice commands?',
      buttons: ['Deny', 'Allow'], defaultId: 0, cancelId: 0 }).then(answer => callback(answer.response === 1), () => callback(false));
  });
  window = new BrowserWindow({ width: 1440, height: 900, minWidth: 800, minHeight: 560,
    title: "GOD'S EYE VIEW", backgroundColor: '#080b10', show: !smoke,
    icon: path.join(root, 'app-icon.png'), webPreferences: {
      nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true,
      allowRunningInsecureContent: false, webviewTag: false,
      backgroundThrottling: !smoke,
    } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, target) => { if (!isAppUrl(target)) event.preventDefault(); });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: "GOD'S EYE VIEW", submenu: [
      { label: 'Map', click: () => window.loadURL(`${APP_ORIGIN}/map/?welcome=0`) },
      { label: 'God Flow', click: () => window.loadURL(`${APP_ORIGIN}/home/`) },
      { type: 'separator' }, { role: 'quit' },
    ] },
    { role: 'viewMenu' }, { role: 'editMenu' },
  ]));
  const errors = [];
  if (smoke) window.webContents.on('console-message', (_event, details, legacyMessage) => {
    if (errors.length < 60) errors.push(String(legacyMessage || details.message || details).replace(/https?:\/\/[^\s]+/g, '[remote URL]'));
  });
  await window.loadURL(`${APP_ORIGIN}/map/?welcome=0`);
  if (smoke) {
    const deadline = Date.now() + 45000;
    let state;
    do {
      state = await window.webContents.executeJavaScript(`({title:document.title,canvas:[...document.querySelectorAll('canvas')].map(c=>({width:c.width,height:c.height})),body:document.body.innerText.slice(0,500)})`);
      if (state.canvas.some(canvas => canvas.width > 100 && canvas.height > 100)) break;
      await new Promise(resolve => setTimeout(resolve, 500));
    } while (Date.now() < deadline);
    await new Promise(resolve => setTimeout(resolve, 20000));
    const rendering = await window.webContents.executeJavaScript(`(() => {
      const api = window.__godsEyeView;
      const v = api?.viewer;
      if (!v) return {apiKeys:Object.keys(api || {})};
      const gl = v.scene.canvas.getContext('webgl2');
      const pixels = new Uint8Array(4 * 64 * 64);
      gl?.readPixels(Math.floor(v.scene.canvas.width/2),Math.floor(v.scene.canvas.height/2),64,64,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      return {apiKeys:Object.keys(api), globe:v.scene.globe.show, tilesLoaded:v.scene.globe.tilesLoaded,
        tileCount:v.scene.globe._surface?._tilesToRender?.length,
        imagery:[...Array(v.imageryLayers.length)].map((_,i)=>({show:v.imageryLayers.get(i).show,alpha:v.imageryLayers.get(i).alpha,ready:v.imageryLayers.get(i).imageryProvider?.ready})),
        pixelMin:Math.min(...pixels),pixelMax:Math.max(...pixels),rgbMean:pixels.reduce((n,x,i)=>n+(i%4===3?0:x),0)/(64*64*3)};
    })()`);
    mkdirSync(qaDir, { recursive: true });
    writeFileSync(path.join(qaDir, 'desktop.png'), (await window.webContents.capturePage()).toPNG());
    writeFileSync(path.join(qaDir, 'desktop-smoke.json'), JSON.stringify({ ...state, rendering, errors, packaged: app.isPackaged,
      version: app.getVersion(), nodeIntegration: window.webContents.getLastWebPreferences().nodeIntegration }, null, 2));
    app.exit(state.canvas.some(canvas => canvas.width > 100 && canvas.height > 100) ? 0 : 1);
  }
}

app.whenReady().then(createWindow).catch(error => {
  if (smoke) { mkdirSync(qaDir, { recursive: true }); writeFileSync(path.join(qaDir, 'desktop-error.txt'), error.message); }
  else dialog.showErrorBox("GOD'S EYE VIEW", error.message);
  app.exit(1);
});
app.on('window-all-closed', () => app.quit());
