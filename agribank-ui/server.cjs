const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');

const root = path.join(__dirname, 'dist');
const upstream = process.env.API_UPSTREAM || 'http://localhost:5000';
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

function proxyApi(req, res) {
  let target;
  try {
    target = new URL(req.url, upstream);
  } catch {
    res.writeHead(502).end('Invalid API_UPSTREAM');
    return;
  }

  const transport = target.protocol === 'https:' ? https : http;
  const headers = { ...req.headers };
  delete headers.connection;
  delete headers.host;
  delete headers.origin;

  const proxyReq = transport.request(target, {
    method: req.method,
    headers,
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (error) => {
    console.error('API proxy error:', error.message);
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('API service unavailable');
  });

  req.pipe(proxyReq);
}

function serveStatic(req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end('Bad request');
    return;
  }

  const candidate = path.resolve(root, '.' + pathname);
  if (candidate !== root && !candidate.startsWith(root + path.sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.stat(candidate, (error, stat) => {
    const file = !error && stat.isFile() ? candidate : path.join(root, 'index.html');
    fs.readFile(file, (readError, body) => {
      if (readError) {
        res.writeHead(404).end('Not found');
        return;
      }
      res.writeHead(200, {
        'content-type': mimeTypes[path.extname(file)] || 'application/octet-stream',
        'content-length': body.length,
      });
      if (req.method === 'HEAD') res.end();
      else res.end(body);
    });
  });
}

const server = http.createServer((req, res) => {
  if (req.url === '/api' || req.url.startsWith('/api/')) proxyApi(req, res);
  else serveStatic(req, res);
});

const port = Number(process.env.PORT || 3000);
server.listen(port, '0.0.0.0', () => {
  console.log('Frontend listening on port ' + port);
});
