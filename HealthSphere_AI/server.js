import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi } from './lib/api.js';
import { ensureSeed } from './lib/seed.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT || 3000);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webmanifest': 'application/webmanifest'
};

ensureSeed();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = decodeURIComponent(url.pathname);

    if (pathname.startsWith('/api/')) {
      let body = null;
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        body = await readJson(req, 25 * 1024 * 1024);
      }
      const query = Object.fromEntries(url.searchParams.entries());
      const handled = await handleApi(req, res, pathname, query, body);
      if (!handled) json(res, 404, { error: 'Unknown API endpoint' });
      return;
    }

    serveStatic(res, pathname);
  } catch (e) {
    console.error('[server]', e);
    try { json(res, 500, { error: 'Internal server error' }); } catch { /* noop */ }
  }
});

function readJson(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('Payload too large'), { statusCode: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve(null);
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (e) { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

function json(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function serveStatic(res, pathname) {
  let rel = pathname === '/' ? '/index.html' : pathname;
  const fp = path.normalize(path.join(PUBLIC, rel));
  if (!fp.startsWith(PUBLIC)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(fp, (err, data) => {
    if (err) {
      // SPA fallback → index.html
      fs.readFile(path.join(PUBLIC, 'index.html'), (e2, html) => {
        if (e2) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' });
        res.end(html);
      });
      return;
    }
    const ext = path.extname(fp).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

function listen(port, attempts = 10) {
  server.once('error', e => {
    if (e.code === 'EADDRINUSE' && attempts > 0) {
      console.log(`Port ${port} busy — trying ${port + 1}…`);
      listen(port + 1, attempts - 1);
    } else { console.error(e); process.exit(1); }
  });
  server.listen(port, () => {
    const u = `http://localhost:${port}`;
    console.log('');
    console.log('  HealthSphere AI - Family Health Intelligence');
    console.log(`  Server: ${u}`);
    console.log('  Demo:   demo@healthsphere.ai / demo1234');
    console.log('');
    if (process.argv.includes('--open') && process.platform === 'win32') {
      import('node:child_process').then(cp => cp.exec(`start "" "${u}"`)).catch(() => {});
    }
  });
}

listen(PORT);
