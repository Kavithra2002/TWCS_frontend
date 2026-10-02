import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicPort = 3000;
const internalPort = 3100;
const internalOrigin = `http://127.0.0.1:${internalPort}`;

// Compiled before the browser is allowed through, so a click does not sit
// behind a cold Turbopack compile.
const routes = ['/login', '/', '/troughs', '/batches', '/schedules', '/alerts', '/reports', '/settings', '/troughs/trough-01'];

const nextBin = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
const child = spawn(
  process.execPath,
  [nextBin, 'dev', '--turbopack', '-H', '127.0.0.1', '-p', String(internalPort)],
  { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
);

function relay(stream, out) {
  let rest = '';
  stream.on('data', (chunk) => {
    rest += chunk.toString();
    const lines = rest.split('\n');
    rest = lines.pop() ?? '';
    for (const line of lines) {
      out.write(line.replaceAll(`127.0.0.1:${internalPort}`, `localhost:${publicPort}`) + '\n');
    }
  });
}

relay(child.stdout, process.stdout);
relay(child.stderr, process.stderr);

let warm = false;

function shutdown() {
  if (!child.killed) child.kill();
  server.close();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
child.on('exit', (code) => process.exit(code ?? 0));

const holdingPage = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="refresh" content="1" />
  <title>TWCS</title>
</head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#020617;color:#e2e8f0;font-family:system-ui,sans-serif">
  <p>Compiling pages once, so the first click is not a long wait…</p>
</body>
</html>`;

function sendHolding(res) {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(holdingPage);
}

function forward(req, res) {
  const proxyReq = http.request(
    {
      host: '127.0.0.1',
      port: internalPort,
      method: req.method,
      path: req.url,
      headers: req.headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );
  proxyReq.on('error', () => {
    if (!res.headersSent) sendHolding(res);
    else res.end();
  });
  req.on('aborted', () => proxyReq.destroy());
  req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
  if (!warm) {
    sendHolding(res);
    return;
  }
  forward(req, res);
});

server.on('upgrade', (req, socket, head) => {
  if (!warm) {
    socket.destroy();
    return;
  }
  const upstream = net.connect(internalPort, '127.0.0.1', () => {
    const lines = [`${req.method} ${req.url} HTTP/1.1`];
    for (const [key, value] of Object.entries(req.headers)) {
      if (value == null) continue;
      for (const item of Array.isArray(value) ? value : [value]) lines.push(`${key}: ${item}`);
    }
    lines.push('', '');
    upstream.write(lines.join('\r\n'));
    if (head.length) upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });
  const drop = () => {
    socket.destroy();
    upstream.destroy();
  };
  upstream.on('error', drop);
  socket.on('error', drop);
});

server.on('error', (error) => {
  console.error(`Could not listen on port ${publicPort}: ${error.message}`);
  shutdown();
  process.exit(1);
});

server.listen(publicPort, () => {
  console.log(`\nTWCS dev: http://localhost:${publicPort}`);
  console.log('Compiling every page once before the app accepts clicks.\n');
});

async function waitForServer() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      await fetch(internalOrigin, { redirect: 'manual' });
      return true;
    } catch {
      await delay(250);
    }
  }
  return false;
}

async function preload() {
  const up = await waitForServer();
  if (!up) {
    console.error('Next dev server did not start.');
    shutdown();
    process.exit(1);
  }

  const started = Date.now();
  for (const route of routes) {
    try {
      await fetch(internalOrigin + route, { redirect: 'manual' });
    } catch {
      // That route still compiles on the first real visit.
    }
  }
  warm = true;
  console.log(`\nPages ready in ${((Date.now() - started) / 1000).toFixed(1)}s — http://localhost:${publicPort}\n`);
}

preload();
