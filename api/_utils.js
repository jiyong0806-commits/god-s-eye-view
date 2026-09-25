export function sendJson(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', headers['cache-control'] || 'no-store');
  res.setHeader('access-control-allow-origin', '*');
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== 'cache-control') res.setHeader(key, value);
  }
  res.end(JSON.stringify(body));
}

export function sendText(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('content-type', headers['content-type'] || 'text/plain; charset=utf-8');
  res.setHeader('cache-control', headers['cache-control'] || 'no-store');
  res.setHeader('access-control-allow-origin', '*');
  res.end(body);
}

export function methodGuard(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-allow-methods', 'GET,OPTIONS');
    res.setHeader('access-control-allow-headers', 'content-type,authorization');
    res.end();
    return false;
  }
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'method-not-allowed' });
    return false;
  }
  return true;
}

export async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'user-agent': 'GODsEyeView/1.0 contact: jiyong0806',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  return { response, body, text };
}
