/**
 * Serves dist/pages the way GitHub Pages serves the project site, so deep links
 * and reloads can be checked before a deploy: under PREFIX (default
 * /hackyeah-2026), a path is the file, else <path>.html, else <path>/index.html
 * (a directory without its trailing slash gets a 301), else 404.html with
 * status 404. Usage: node scripts/preview-pages.mjs [dir] [port] [prefix]
 * (PORT in the environment wins over the argument).
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const [dir = 'dist/pages', portArg = '4830', prefix = '/hackyeah-2026'] = process.argv.slice(2);
const port = Number(process.env.PORT ?? portArg);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
};
const isFile = (path) => existsSync(path) && statSync(path).isFile();
const isDir = (path) => existsSync(path) && statSync(path).isDirectory();

function send(res, status, file) {
  res.writeHead(status, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  createReadStream(file).pipe(res);
}

if (!isFile(join(dir, '404.html'))) {
  console.error(`No site in ${dir}. Run npm run build:pages first.`);
  process.exit(1);
}

createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://local');
  if (pathname === '/') {
    res.writeHead(302, { Location: `${prefix}/` }).end();
    return;
  }
  if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) {
    res.writeHead(404).end('Not under the site prefix');
    return;
  }
  const rel = normalize(decodeURIComponent(pathname.slice(prefix.length))).replace(/^(\.\.[/\\])+/, '');
  const path = join(dir, rel);
  if (isFile(path)) return send(res, 200, path);
  if (isDir(path)) {
    if (!pathname.endsWith('/')) {
      res.writeHead(301, { Location: `${pathname}/` }).end();
      return;
    }
    if (isFile(join(path, 'index.html'))) return send(res, 200, join(path, 'index.html'));
  }
  if (isFile(`${path}.html`)) return send(res, 200, `${path}.html`);
  send(res, 404, join(dir, '404.html'));
}).listen(port, () => console.log(`Serving ${dir} at http://localhost:${port}${prefix}/`));
