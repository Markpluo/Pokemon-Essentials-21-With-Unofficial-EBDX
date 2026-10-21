// The online game server: an HTTP server with a health check and a WebSocket endpoint at /ws.
// Every message is JSON; see packages/core/src/online.ts for the protocol.
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { Content } from '@hafnia/core';
import { hafnia } from '@hafnia/pack-hafnia';
import { makeVerifier } from './auth';
import { config } from './config';
import { Hub } from './hub';
import { PgStore } from './pg-store';
import { MemoryStore, type Store } from './store';

const PACKS = [hafnia];

if (!config.supabaseUrl && !config.jwtSecret && !config.devAuth) {
  console.error('Set SUPABASE_URL (or SUPABASE_JWT_SECRET), or DEV_AUTH=1 for local development.');
  process.exit(1);
}
if (config.devAuth && process.env.NODE_ENV === 'production') {
  console.error('DEV_AUTH must not be used in production.');
  process.exit(1);
}

if (!config.databaseUrl && process.env.NODE_ENV === 'production') {
  console.error('Set DATABASE_URL: production keeps accounts and characters in Postgres.');
  process.exit(1);
}

let store: Store;
if (config.databaseUrl) store = new PgStore(config.databaseUrl);
else {
  mkdirSync(dirname(config.dataFile), { recursive: true });
  store = new MemoryStore(config.dataFile);
  console.log(`No DATABASE_URL: keeping data in ${config.dataFile}`);
}

const hub = new Hub({
  store, content: new Content(PACKS), admins: config.admins, maxPlayers: config.maxPlayers, debug: config.devAuth,
  verify: makeVerifier({ supabaseUrl: config.supabaseUrl, jwtSecret: config.jwtSecret, devAuth: config.devAuth })
});
hub.start();

const http = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, players: hub.sessions.size }));
    return;
  }
  res.writeHead(404).end();
});

const wss = new WebSocketServer({
  server: http, path: '/ws', maxPayload: 16 * 1024,
  verifyClient: ({ origin }: { origin?: string }) => !config.origins.length || (!!origin && config.origins.includes(origin))
});

wss.on('connection', ws => {
  const conn = hub.connect({
    send: msg => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg)); },
    close: () => ws.close(4000)
  });
  let alive = true;
  ws.on('pong', () => { alive = true; });
  const ping = setInterval(() => { if (!alive) ws.terminate(); alive = false; ws.ping(); }, 30_000);
  ws.on('message', data => {
    let msg: unknown;
    try { msg = JSON.parse(String(data)); } catch { return; }
    conn.receive(msg);
  });
  ws.on('close', () => { clearInterval(ping); void conn.closed(); });
});

http.listen(config.port, () => console.log(`Copper & Current server on :${config.port}`));

async function shutdown() {
  console.log('Shutting down: saving everyone...');
  await hub.stop();
  await store.close();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
