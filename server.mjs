// Локальный сервер: раздаёт public/ и вызывает функции из api/ так же, как Vercel.
// Запуск: node server.mjs   (порт — PORT или 5230; переменные — из .env, если он есть)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const root = here('./public/');
try { process.loadEnvFile(here('./.env')); } catch { /* .env нет — ок */ }

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
};

// Заголовки из vercel.json, чтобы локально работал тот же CSP.
const vercel = JSON.parse(readFileSync(here('./vercel.json'), 'utf8'));
function applyHeaders(res, pathname) {
  for (const rule of vercel.headers || []) {
    const re = new RegExp('^' + rule.source.replace('(.*)', '.*') + '$');
    if (re.test(pathname)) for (const h of rule.headers) res.setHeader(h.key, h.value);
  }
}

const API = new Set(['lead', 'bot', 'setup', 'health']);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  applyHeaders(res, url.pathname);

  const api = url.pathname.match(/^\/api\/([a-z]+)\/?$/);
  if (api) {
    if (!API.has(api[1])) { res.statusCode = 404; return res.end('Not found'); }
    let raw = '';
    for await (const chunk of req) { raw += chunk; if (raw.length > 64_000) break; }
    req.body = raw;
    req.query = Object.fromEntries(url.searchParams);
    try {
      const mod = await import(pathToFileURL(here(`./api/${api[1]}.js`)).href);
      return await mod.default(req, res);
    } catch (err) {
      console.error(err);
      res.statusCode = 500;
      return res.end('{"ok":false}');
    }
  }

  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  const file = join(root, rel.endsWith('/') ? rel + 'index.html' : rel);
  if (!file.startsWith(root)) { res.statusCode = 403; return res.end(); }
  try {
    const data = await readFile(file);
    res.setHeader('Content-Type', TYPES[extname(file)] || 'application/octet-stream');
    res.end(data);
  } catch {
    res.statusCode = 404;
    res.end('Not found');
  }
});

const port = Number(process.env.PORT) || 5230;
server.listen(port, '127.0.0.1', () => console.log(`pcstore → http://localhost:${port}`));
