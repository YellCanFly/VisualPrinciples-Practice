import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.otf': 'font/otf', '.ply': 'application/octet-stream', '.fbx': 'application/octet-stream',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8', '.map': 'application/json',
};

export function normalizeBase(value = '/') {
  const segments = value.split('/').filter(Boolean);
  if (segments.some(segment => segment === '.' || segment === '..' || /[\\:%?#\0]/.test(segment))) {
    throw new Error('--base must be a URL directory, for example /VisualPrinciples-Practice/');
  }
  return segments.length ? `/${segments.join('/')}/` : '/';
}

function inside(root, target) {
  const part = relative(root, target);
  return part === '' || (!isAbsolute(part) && part !== '..' && !part.startsWith(`..${sep}`));
}

/** Read-only, loopback static server. A realpath check also blocks escaping symlinks. */
export function createStaticServer({ root, base = '/' }) {
  const directory = resolve(root);
  const mount = normalizeBase(base);
  return createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
    const fail = (status, message) => {
      response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(request.method === 'HEAD' ? undefined : message);
    };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.setHeader('Allow', 'GET, HEAD');
      fail(405, 'Method not allowed');
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
    } catch {
      fail(400, 'Invalid URL');
      return;
    }
    if (pathname.includes('\0') || pathname.includes('\\') || pathname.includes(':')) {
      fail(400, 'Invalid path');
      return;
    }
    if (mount !== '/' && pathname === mount.slice(0, -1)) {
      response.writeHead(308, { Location: mount });
      response.end();
      return;
    }
    if (!pathname.startsWith(mount)) {
      fail(404, 'Not found');
      return;
    }
    const segments = pathname.slice(mount.length).split('/').filter(Boolean);
    if (segments.some(segment => segment === '.' || segment === '..' || segment.startsWith('.'))) {
      fail(403, 'Path outside public files');
      return;
    }
    const filePath = resolve(directory, ...segments, ...(pathname.endsWith('/') ? ['index.html'] : []));
    if (!inside(directory, filePath)) {
      fail(403, 'Path outside public files');
      return;
    }
    try {
      const [realRoot, realFile] = await Promise.all([realpath(directory), realpath(filePath)]);
      if (!inside(realRoot, realFile)) {
        fail(403, 'Path outside public files');
        return;
      }
      const info = await stat(realFile);
      if (info.isDirectory() && !pathname.endsWith('/')) {
        const requested = new URL(request.url, 'http://localhost');
        requested.pathname += '/';
        response.writeHead(308, { Location: requested.pathname + requested.search });
        response.end();
        return;
      }
      if (!info.isFile()) {
        fail(404, 'Not found');
        return;
      }
      response.writeHead(200, {
        'Content-Type': MIME[extname(realFile).toLowerCase()] ?? 'application/octet-stream',
        'Content-Length': info.size,
      });
      if (request.method === 'HEAD') {
        response.end();
        return;
      }
      createReadStream(realFile).on('error', () => response.destroy()).pipe(response);
    } catch {
      fail(404, 'Not found');
    }
  });
}

async function main() {
  const args = process.argv.slice(2);
  let port = 4173;
  let explicitPort = false;
  let retries = 0;
  let base = '/';
  let open = false;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--port') { port = Number(args[++i]); explicitPort = true; }
    else if (args[i] === '--base') base = normalizeBase(args[++i]);
    else if (args[i] === '--open') open = true;
    else if (args[i] === '--no-open') open = false;
    else throw new Error(`Unknown option: ${args[i]}`);
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Port must be 1–65535');
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
  try { await stat(resolve(root, 'index.html')); } catch {
    throw new Error('dist/index.html is missing. Run npm run setup and npm run build first.');
  }
  const server = createStaticServer({ root, base });
  server.on('error', error => {
    if (error.code === 'EADDRINUSE' && !explicitPort && retries < 20) {
      console.log(`Port ${port} is in use; trying ${port + 1}.`);
      retries += 1;
      port += 1;
      server.listen(port, '127.0.0.1');
      return;
    }
    console.error(error.code === 'EADDRINUSE'
      ? `Port ${port} is in use. Open the existing server, or use --port ${port + 1}.`
      : error.message);
    process.exitCode = 1;
  });
  server.once('listening', () => {
    const url = `http://127.0.0.1:${port}${base}`;
    console.log(`VisualPrinciples Practice: ${url}`);
    console.log('Keep this terminal open. Press Ctrl+C to stop. All runtime assets are local.');
    if (open) {
      const command = process.platform === 'win32' ? 'rundll32.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
      const openArgs = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url];
      const browser = spawn(command, openArgs, { detached: true, stdio: 'ignore', windowsHide: true });
      browser.on('error', () => console.log(`Open this URL manually: ${url}`));
      browser.unref();
    }
  });
  server.listen(port, '127.0.0.1');
  process.on('SIGINT', () => server.close(() => process.exit(0)));
  process.on('SIGTERM', () => server.close(() => process.exit(0)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
