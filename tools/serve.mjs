// Tiny local web server for previewing docs/index.html: node tools/serve.mjs [port] [folder] [host]
// host 0.0.0.0 makes it reachable from other devices in your own Wi-Fi (for testing on a phone).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// optional third argument: folder to serve, relative to the project (default: docs)
const root = fileURLToPath(new URL(`../${process.argv[3] || 'docs'}/`, import.meta.url));
const port = Number(process.argv[2] || 8765);
createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.endsWith('/') ? `${path.slice(1)}index.html` : path.slice(1);
  if (file.includes('..')) { res.writeHead(400).end(); return; }
  try {
    const body = await readFile(root + file);
    const types = { html: 'text/html; charset=utf-8', png: 'image/png', svg: 'image/svg+xml' };
    res.writeHead(200, { 'content-type': types[file.split('.').pop()] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end('not found'); }
}).listen(port, process.argv[4] || '127.0.0.1', () => console.log(`serving on port ${port}`));
