// server/index.js
// Main server — Express for webhooks + HTTP API, ws for overlay WebSocket

require('dotenv').config({ encoding: 'utf8' });
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const { startAutoRefresh } = require('./sheets');
const { registerClient, addSong, addPending, acceptPending, skipSong, clearQueue, getState, deleteSong, moveSong } = require('./queue');
const { verifySignature } = require('./twitch');
const { handleRedemption } = require('./redemptions');
const { createTwitchConnection } = require('./twitch-connection');
const { init: initHistory, recordRequest, getHistory } = require('./history');

const twitch = createTwitchConnection({ onRedemption: handleRedemption });
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ─── Raw body capture (needed for Twitch signature verification) ──────────────
app.use((req, res, next) => {
  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => {
    const buf = Buffer.concat(chunks);
    req.rawBody = buf.toString('utf8');
    try { req.body = JSON.parse(buf.toString('utf8')); } catch (_) { req.body = {}; }
    next();
  });
});

// ─── Static overlay files ─────────────────────────────────────────────────────
app.use('/overlay', express.static(path.join(__dirname, '..', 'overlay')));
app.use('/dashboard', express.static(path.join(__dirname, '..', 'dashboard')));

app.use('/auth/twitch', require('./twitch-auth')(twitch));
app.get('/api/twitch/status', (req, res) => res.json(twitch.getStatus()));

// ─── Twitch EventSub Webhook ──────────────────────────────────────────────────
app.post('/twitch/webhook', async (req, res) => {
  // 1. Verify the request is really from Twitch
  if (!verifySignature(req)) {
    console.warn('[webhook] Invalid signature — request rejected');
    return res.sendStatus(403);
  }

  const messageType = req.headers['twitch-eventsub-message-type'];

  // 2. Twitch sends a challenge when first registering the subscription
  if (messageType === 'webhook_callback_verification') {
    console.log('[webhook] Verification challenge received — subscription confirmed!');
    return res.status(200).send(req.body.challenge);
  }

  // 3. Handle revocation
  if (messageType === 'revocation') {
    console.warn('[webhook] Subscription revoked:', req.body.subscription?.status);
    return res.sendStatus(204);
  }

  // 4. Handle actual redemption events
  if (messageType === 'notification') {
    handleRedemption(req.body.event);

    return res.sendStatus(204);
  }

  res.sendStatus(204);
});

// ─── REST API (for dashboard / manual control) ───────────────────────────────
app.use('/api/integrations/leihu/selection', require('./leihu')());
app.get('/api/queue', (req, res) => res.json(getState()));
app.post('/api/skip', (req, res) => res.json({ nowPlaying: skipSong() }));
app.post('/api/clear', (req, res) => { clearQueue(); res.json({ ok: true }); });

// Manual add (for testing without Twitch)
app.post('/api/add', (req, res) => {
  const { title, artist, key, requester } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const entry = addSong({ title: title.trim(), artist: artist || '', key: key || '', requester: requester || 'manual' });
  recordRequest({ title: title.trim(), artist: artist || '', requester: requester || 'manual' });
  res.json({ ok: true, entry });
});

// Delete a song by zone (nowPlaying, queue, played) and index
app.post('/api/delete', (req, res) => {
  const { zone, index } = req.body;
  const result = deleteSong(zone, index);
  if (!result) return res.status(400).json({ error: 'invalid zone or index' });
  res.json({ ok: true });
});

// Move a song between zones or reorder within a zone
app.post('/api/move', (req, res) => {
  const { fromZone, fromIndex, toZone, toIndex } = req.body;
  const result = moveSong(fromZone, fromIndex, toZone, toIndex);
  if (!result) return res.status(400).json({ error: 'invalid move' });
  res.json({ ok: true });
});

// Force refresh song list from Google Sheets
app.post('/api/refresh-songs', async (req, res) => {
  const { fetchSongs } = require('./sheets');
  const songs = await fetchSongs();
  res.json({ ok: true, count: songs.length });
});

// Accept a pending entry → move to queue (with optional edits)
app.post('/api/accept-pending', (req, res) => {
  const { index, title, artist } = req.body;
  const result = acceptPending(index, title, artist);
  if (!result) return res.status(400).json({ error: 'invalid index' });
  res.json({ ok: true });
});

app.get('/api/songs', (req, res) => {
  const { getSongs } = require('./sheets');
  res.json(getSongs());
});

// Get request history (for dashboard cards)
app.get('/api/history', (req, res) => {
  res.json(getHistory());
});

// ─── WebSocket (overlay connections) ─────────────────────────────────────────
wss.on('connection', (ws, req) => {
  console.log(`[ws] Overlay connected from ${req.socket.remoteAddress}`);
  registerClient(ws);
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

async function start() {
  console.log('\n🎵 VTuber Song Queue starting...\n');

  await startAutoRefresh();
  await initHistory();

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, resolve);
  });
  const listeningPort = server.address().port;
  console.log(`\n✅ Server running at http://localhost:${listeningPort}`);
  console.log(`   Overlay URL: http://localhost:${listeningPort}/overlay/index.html`);
  console.log(`   API:         http://localhost:${listeningPort}/api/queue\n`);
  await twitch.start();
}

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => {
    twitch.stop();
    wss.clients.forEach(client => client.terminate());
    server.close(() => process.exit(0));
  });
}

start().catch(err => {
  console.error('Fatal startup error:', err.message);
  process.exit(1);
});
