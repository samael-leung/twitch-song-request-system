// server/veadotube.js
// Talks to the running veadotube mini windows (https://veado.tube/docs/tech/api/). Each window
// with its WebSocket server on writes a small JSON file in ~/.veadotube/instances (refreshed every
// few seconds; the address changes on every launch). We read those, connect to each window, and
// keep its avatar states and the state it shows. Messages are "nodes:" + JSON; the avatar is the
// stateEvents node "mini" (list / peek / thumb / set).

const fs = require('fs');
const os = require('os');
const path = require('path');
const WebSocket = require('ws');

const DIR = process.env.VEADOTUBE_DIR || path.join(os.homedir(), '.veadotube', 'instances');   // tests use a temp folder
const SCAN_MS = 3000;
const STALE_S = 15;           // veadotube rewrites the file every few seconds; older ones are closed windows
const THUMB_TIMEOUT_MS = 4000;
const CLIENT_NAME = 'Song Request System';

const windows = new Map();    // instance id → { id, server, ws, states, current }
const thumbs = new Map();     // thumbHash → PNG buffer
let onChange = () => {};
let timer = null;

// Windows with their server on, from the instance files (empty or old files are skipped)
function scan(now = Date.now() / 1000) {
  let files = [];
  try { files = fs.readdirSync(DIR); } catch { return []; }
  const found = [];
  for (const f of files) {
    try {
      const info = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8').replace(/\0/g, '').trim());
      if (info.server && info.id && Math.abs(now - Number(info.time)) <= STALE_S) found.push({ id: info.id, server: info.server });
    } catch {}
  }
  return found;
}

function send(w, payload) {
  if (w.ws.readyState === WebSocket.OPEN) {
    w.ws.send('nodes:' + JSON.stringify({ event: 'payload', type: 'stateEvents', id: 'mini', payload }));
  }
}

function open({ id, server }) {
  const w = { id, server, states: [], current: '', waiting: new Map() };
  w.ws = new WebSocket(`ws://${server}?n=${encodeURIComponent(CLIENT_NAME)}`);
  w.ws.on('open', () => { send(w, { event: 'list' }); send(w, { event: 'peek' }); });
  w.ws.on('message', (m) => {
    const s = String(m);
    if (!s.startsWith('nodes:')) return;
    let msg;
    try { msg = JSON.parse(s.slice(6)); } catch { return; }
    const p = msg.type === 'stateEvents' && msg.payload;
    if (!p) return;
    if (p.event === 'list' && Array.isArray(p.states)) {
      w.states = p.states.map(x => ({ id: String(x.id), name: String(x.name || x.id), thumbHash: String(x.thumbHash || '') }));
      onChange();
    } else if (p.event === 'peek' && p.state !== w.current) {
      w.current = String(p.state || '');
      onChange();
    } else if (p.event === 'thumb' && p.png) {
      const buf = Buffer.from(p.png, 'base64');
      if (p.hash) thumbs.set(String(p.hash), buf);
      const done = w.waiting.get(String(p.state));
      if (done) { w.waiting.delete(String(p.state)); done(buf); }
    }
  });
  w.ws.on('error', () => {});
  w.ws.on('close', () => {
    if (windows.get(id) !== w) return;
    windows.delete(id);
    onChange();
  });
  windows.set(id, w);
}

// Opens new windows, drops closed ones, and asks each what it shows (changed by hand in veadotube too);
// the state list is asked again now and then, for states added or renamed in veadotube
let rounds = 0;
function refresh() {
  const found = scan();
  for (const f of found) {
    const w = windows.get(f.id);
    if (w && w.server !== f.server) { windows.delete(f.id); w.ws.terminate(); }
    if (!windows.has(f.id)) open(f);
  }
  for (const [id, w] of windows) {
    if (!found.some(f => f.id === id)) { windows.delete(id); w.ws.terminate(); onChange(); continue; }
    send(w, { event: 'peek' });
    if (rounds % 5 === 0) send(w, { event: 'list' });
  }
  rounds++;
}

function start(changed) {
  onChange = changed || (() => {});
  if (timer) return;
  refresh();
  timer = setInterval(refresh, SCAN_MS);
  timer.unref?.();
}

function stop() {
  clearInterval(timer);
  timer = null;
  for (const w of windows.values()) w.ws.terminate();
  windows.clear();
}

function list() {
  return [...windows.values()].filter(w => w.states.length).map(w => ({ id: w.id, states: w.states, current: w.current }));
}

// The windows that have this state (two windows can show the same avatar)
function windowsWith(state) {
  return [...windows.values()].filter(w => w.states.some(s => s.id === state));
}

function set(windowId, state) {
  const w = windows.get(windowId);
  if (!w || !w.states.some(s => s.id === state)) return false;
  send(w, { event: 'set', state });
  w.current = state;   // peek confirms on the next round
  onChange();
  return true;
}

// The state's 128 × 128 picture (PNG), cached by its hash
function thumb(windowId, state) {
  const w = windows.get(windowId);
  const s = w && w.states.find(x => x.id === state);
  if (!s) return Promise.resolve(null);
  if (s.thumbHash && thumbs.has(s.thumbHash)) return Promise.resolve(thumbs.get(s.thumbHash));
  return new Promise((resolve) => {
    const t = setTimeout(() => { w.waiting.delete(state); resolve(null); }, THUMB_TIMEOUT_MS);
    w.waiting.set(state, (buf) => { clearTimeout(t); resolve(buf); });
    send(w, { event: 'thumb', state });
  });
}

module.exports = { start, stop, scan, list, windowsWith, set, thumb };
