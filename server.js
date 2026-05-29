/* =====================================================================
   VERDANT — Multiplayer Relay Server
   Heleo2 Studio
   ---------------------------------------------------------------------
   Authoritative-lite state relay. Each client streams its position;
   the server broadcasts the full peer list to everyone ~12x/sec.
   This is intentionally simple (good enough for an MVP demo). For a
   production game you'd add: server-authoritative movement validation,
   tick-based snapshots + interpolation, lag compensation, rooms, and
   anti-cheat. Hooks are noted inline.

   RUN:
     npm install ws
     node server.js
   Then in the game: Multiplayer -> Server URL: ws://localhost:8080 -> Connect
   ===================================================================== */
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const TICK_MS = 80; // ~12 Hz broadcast

const wss = new WebSocketServer({ port: PORT });
const players = new Map(); // id -> { ws, name, x, y, z, ry }
let nextId = 1;

console.log(`[VERDANT] Multiplayer relay listening on ws://localhost:${PORT}`);

wss.on('connection', (ws) => {
  const id = nextId++;
  players.set(id, { ws, name: 'Operator', x: 0, y: 1, z: 0, ry: 0 });
  ws.send(JSON.stringify({ t: 'welcome', id }));
  console.log(`[+] player ${id} connected (${players.size} online)`);

  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    const p = players.get(id);
    if (!p) return;
    if (m.t === 'join') {
      p.name = String(m.name || 'Operator').slice(0, 24);
    } else if (m.t === 'state') {
      // (production: validate deltas here to reject teleport/speed hacks)
      p.x = m.x; p.y = m.y; p.z = m.z; p.ry = m.ry;
    }
  });

  ws.on('close', () => {
    players.delete(id);
    broadcast({ t: 'leave', id });
    console.log(`[-] player ${id} left (${players.size} online)`);
  });

  ws.on('error', () => {});
});

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  for (const { ws } of players.values()) {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  }
}

// state broadcast loop
setInterval(() => {
  if (players.size === 0) return;
  const list = [];
  for (const [id, p] of players) {
    list.push({ id, name: p.name, x: p.x, y: p.y, z: p.z, ry: p.ry });
  }
  broadcast({ t: 'peers', list });
}, TICK_MS);
