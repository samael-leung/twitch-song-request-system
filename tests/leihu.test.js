const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const WebSocket = require('ws');
const { loadQueue } = require('./helpers');
const install = require('../server/leihu-selection-compat');

async function fixture(t) {
  const loaded = loadQueue(t), queue = loaded.queue;
  const app = express(); app.use(express.json());
  install(app, { queue, leihu: { setLink() {} } });
  const server = http.createServer(app);
  const wss = new WebSocket.Server({ server });
  wss.on('connection', queue.registerClient);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const ws = new WebSocket(base.replace('http:', 'ws:'));
  t.after(async () => {
    ws.terminate(); wss.clients.forEach(client => client.terminate());
    await new Promise(resolve => server.close(resolve)); wss.close();
  });
  await new Promise(resolve => ws.once('message', resolve));
  const route = base + '/api/integrations/leihu/selection';
  const get = () => fetch(route).then(r => r.json());
  async function select(song, action) {
    const response = await fetch(route, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ song, action, expectedRevision: (await get()).revision }) });
    assert.equal(response.status, 200); return response.json();
  }
  return { ...loaded, ws, get, select };
}

test('selection broadcasts canonical requester/key and persists the link with unchanged queue order', async t => {
  const s = await fixture(t), q = s.queue;
  q.addSong({ title: '目前歌曲', requester: 'first' });
  q.addSong({ title: '下一首', artist: '歌手', key: -2, requester: 'viewer' });
  const broadcast = new Promise(resolve => {
    const receive = raw => {
      const state = JSON.parse(raw);
      if (state.nowPlaying?.leihuId === 'next') { s.ws.off('message', receive); resolve(state); }
    };
    s.ws.on('message', receive);
  });
  await s.select({ id: 'next', title: '下一首', artist: '歌手' });
  const pushed = await broadcast;
  assert.equal(pushed.nowPlaying.requester, 'viewer');
  assert.equal(pushed.nowPlaying.key, '-2');
  assert.deepEqual(pushed.queue.map(song => song.title), ['目前歌曲']);
  await s.select({ id: 'corrected', title: 'Decorated YouTube title' }, 'link');
  const restored = s.reload().getState();
  assert.equal(restored.nowPlaying.leihuId, 'corrected');
  assert.equal(restored.nowPlaying.title, '下一首');
  assert.equal(restored.nowPlaying.requester, 'viewer');
  assert.deepEqual(Array.from(restored.queue, song => song.title), ['目前歌曲']);
});

test('external selection keeps redemptions pending until the song is actually finished', async t => {
  const s = await fixture(t), q = s.queue, settlements = [];
  q.setRedemptionHook((redemption, action) => settlements.push([redemption.id, action]));
  q.addSong({ title: 'Current', requester: 'first', redemption: { id: 'r1', rewardId: 'reward' } });
  q.addPending({ requester: 'picker', candidates: [{ title: 'Same', artist: 'A', key: '2' },
    { title: 'Same', artist: 'B', key: '-3' }], redemption: { id: 'r2', rewardId: 'reward' } });
  await s.select({ id: 'songbb', title: 'Same', artist: 'B' });
  assert.deepEqual(settlements, []);
  const saved = s.reload().getState();
  assert.equal(saved.nowPlaying.artist, 'B'); assert.equal(saved.nowPlaying.key, '-3');
  assert.equal(saved.nowPlaying.redemption.id, 'r2'); assert.equal(saved.queue[0].redemption.id, 'r1');
  q.skipSong(); assert.deepEqual(settlements, [['r2', 'done']]);
  await s.select({ id: 'songbb', title: 'Same', artist: 'B' });
  q.skipSong(); assert.deepEqual(settlements, [['r2', 'done']]);
});

test('drag to pending and back retains links, key, random-tab filter and redemption; redraw revises selection', async t => {
  const s = await fixture(t), q = s.queue;
  q.addSong({ title: 'Random', artist: 'Singer', requester: 'viewer', key: '-3', isRandom: true,
              tabs: ['粵語'], redemption: { id: 'r1', rewardId: 'reward' } });
  await s.select({ id: 'random', title: 'Random', artist: 'Singer' });
  q.moveSong('nowPlaying', 0, 'pending', 0);
  assert.equal(q.getState().pending[0].leihuId, 'random');
  await s.select({ id: 'random', title: 'Random', artist: 'Singer' });
  const restored = s.reload().getState().nowPlaying;
  assert.equal(restored.key, '-3'); assert.equal(restored.isRandom, true);
  assert.deepEqual(Array.from(restored.tabs), ['粵語']); assert.equal(restored.redemption.id, 'r1');
  const revision = (await s.get()).revision;
  q.redrawSong('nowPlaying', 0, { title: 'Redrawn', artist: 'Other', key: 1, requester: 'viewer', isRandom: true });
  assert.notEqual((await s.get()).revision, revision);
  await s.select({ id: 'redrawn', title: 'Redrawn', artist: 'Other' });
  assert.equal(q.getState().nowPlaying.isRandom, true);
});
