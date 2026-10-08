/**
 * dev-server.mjs — wraps `next dev --turbopack` with Windows ENOENT fixes:
 *
 *  1. Clears .next before every start so a corrupt cache is never carried forward.
 *  2. Detects the _buildManifest / app-build-manifest ENOENT crash and auto-restarts
 *     Next.js (up to MAX_RESTARTS times) — the outer proxy stays alive so the browser
 *     just shows a 1-second spinner instead of "Internal Server Error".
 *  3. Pre-warms every app route so the first browser click is instant.
 */

import fs   from 'node:fs';
import http from 'node:http';
import net  from 'node:net';
import path from 'node:path';
import { spawn }               from 'node:child_process';
import { fileURLToPath }       from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root           = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nextDir        = path.join(root, '.next');
const publicPort     = 3000;
const internalPort   = 3100;
const internalOrigin = `http://127.0.0.1:${internalPort}`;
const MAX_RESTARTS   = 5;

// ── All current app routes — update this list when pages are added/removed ──
const routes = [
  '/login',
  '/',
  '/dashboard-2',
  '/simulator',
  '/troughs',
  '/troughs/trough-01',
  '/batches',
  '/schedules',
  '/alerts',
  '/reports',
  '/settings',
  '/users',
  '/master-data',
];

const nextBin    = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
let   restarts   = 0;
let   warm       = false;
let   child      = null;
let   shuttingDown = false;

// ── 1. Wipe the cache so we never start from a corrupt state ─────────────────
process.stdout.write('Clearing .next cache… ');
try {
  fs.rmSync(nextDir, { recursive: true, force: true });
  process.stdout.write('done.\n');
} catch (e) {
  process.stdout.write(`skipped (${e.message})\n`);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function isManifestCrash(line) {
  return (
    line.includes('ENOENT') &&
    (line.includes('app-build-manifest') || line.includes('_buildManifest'))
  );
}

function clearCache() {
  try { fs.rmSync(nextDir, { recursive: true, force: true }); } catch {}
}

// Kill a process + its tree on Windows, fall back to proc.kill() on others.
function killTree(proc) {
  if (!proc) return;
  try {
    spawn('taskkill', ['/F', '/T', '/PID', String(proc.pid)], { stdio: 'ignore' });
  } catch {
    try { proc.kill(); } catch {}
  }
}

// Wait until port is free (old process released it) before binding a new one.
async function waitForPortFree(port, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const free = await new Promise((resolve) => {
      const s = net.createServer();
      s.once('error', () => resolve(false));
      s.once('listening', () => { s.close(() => resolve(true)); });
      s.listen(port, '127.0.0.1');
    });
    if (free) return;
    await delay(300);
  }
}

// ── Proxy server (stays alive across Next.js restarts) ───────────────────────
const holdingPage = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta http-equiv="refresh" content="1"/>
  <title>TWCS — starting…</title>
</head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;
             background:#020617;color:#e2e8f0;font-family:system-ui,sans-serif">
  <p>Compiling pages — this tab will reload automatically…</p>
</body>
</html>`;

function sendHolding(res) {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(holdingPage);
}

function forward(req, res) {
  const pr = http.request(
    { host: '127.0.0.1', port: internalPort, method: req.method,
      path: req.url, headers: req.headers },
    (up) => { res.writeHead(up.statusCode ?? 502, up.headers); up.pipe(res); },
  );
  pr.on('error', () => { if (!res.headersSent) sendHolding(res); else res.end(); });
  req.on('aborted', () => pr.destroy());
  req.pipe(pr);
}

const server = http.createServer((req, res) => {
  if (!warm) { sendHolding(res); return; }
  forward(req, res);
});

server.on('upgrade', (req, socket, head) => {
  if (!warm) { socket.destroy(); return; }
  const up = net.connect(internalPort, '127.0.0.1', () => {
    const lines = [`${req.method} ${req.url} HTTP/1.1`];
    for (const [k, v] of Object.entries(req.headers))
      for (const item of Array.isArray(v) ? v : [v]) lines.push(`${k}: ${item}`);
    lines.push('', '');
    up.write(lines.join('\r\n'));
    if (head.length) up.write(head);
    up.pipe(socket); socket.pipe(up);
  });
  const drop = () => { socket.destroy(); up.destroy(); };
  up.on('error', drop); socket.on('error', drop);
});

server.on('error', (e) => { console.error(`Proxy error: ${e.message}`); process.exit(1); });
server.listen(publicPort);

// ── 2. Spawn / auto-restart Next.js ──────────────────────────────────────────
function spawnNext() {
  const proc = spawn(
    process.execPath,
    [nextBin, 'dev', '--turbopack', '-H', '127.0.0.1', '-p', String(internalPort)],
    { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
  );

  let crashQueued = false;

  function relay(stream, out) {
    let rest = '';
    stream.on('data', (chunk) => {
      rest += chunk.toString();
      const lines = rest.split('\n');
      rest = lines.pop() ?? '';
      for (const line of lines) {
        if (/^\s*-\s+(Local|Network):/.test(line)) continue;
        out.write(line + '\n');

        // Detect Windows manifest race crash — queue one restart
        if (!crashQueued && isManifestCrash(line) && restarts < MAX_RESTARTS) {
          crashQueued = true;
          restarts++;
          console.log(
            `\n[dev-server] Windows cache race detected — restart ${restarts}/${MAX_RESTARTS}…\n`
          );
          warm = false;
          killTree(proc);
        }
      }
    });
  }

  relay(proc.stdout, process.stdout);
  relay(proc.stderr, process.stderr);

  proc.on('exit', (code) => {
    if (shuttingDown) {
      // User pressed Ctrl+C — exit cleanly without spawning anything
      server.close();
      process.exit(0);
      return;
    }
    if (restarts >= MAX_RESTARTS) {
      console.error('\n[dev-server] Max restarts reached. Exiting.\n');
      server.close();
      process.exit(code ?? 1);
      return;
    }
    if (crashQueued) {
      // Use an async IIFE so we can await without setTimeout races
      (async () => {
        if (shuttingDown) return;   // check again — Ctrl+C may have arrived during the await
        clearCache();
        // Wait for the killed process to actually release port 3100
        await waitForPortFree(internalPort);
        if (shuttingDown) return;
        child = spawnNext();
        // After a crash-restart just wait for the server to come back up
        await waitForServer();
        if (shuttingDown) return;
        warm = true;
        console.log(`\n  http://localhost:${publicPort}  (recovered)\n`);
      })();
    } else {
      // Normal (non-crash) exit — propagate the exit code
      process.exit(code ?? 0);
    }
  });

  return proc;
}

child = spawnNext();

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  killTree(child);   // force-kill the whole Next.js process tree on Windows
  server.close();
  // Give the kill a moment to take effect, then exit
  setTimeout(() => process.exit(0), 1500);
}
process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);

// ── 3. Pre-warm all routes on first start ────────────────────────────────────
async function waitForServer() {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try { await fetch(internalOrigin, { redirect: 'manual' }); return true; }
    catch { await delay(300); }
  }
  return false;
}

async function preload() {
  const up = await waitForServer();
  if (!up) {
    console.error('Next dev server did not come up in time.');
    shutdown();
    return;
  }
  if (shuttingDown) return;

  console.log('Pre-compiling routes…');
  for (const route of routes) {
    if (shuttingDown) break;
    try {
      process.stdout.write(`  ${route} … `);
      await fetch(internalOrigin + route, { redirect: 'manual' });
      process.stdout.write('done\n');
    } catch {
      process.stdout.write('(will compile on first visit)\n');
    }
  }

  if (shuttingDown) return;
  warm = true;
  console.log(`\n  http://localhost:${publicPort}\n`);
  console.log(
    '  TIP: Add .next to Windows Defender exclusions to prevent cache errors:\n' +
    `  E:\\AMBEON\\TWCS\\frontend\\.next\n`
  );
}

preload();
