const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const WebSocket = require('ws');
const queue = require('../server/queue');

test('selection API promotes requests, preserves metadata, broadcasts and rejects stale writes', async t => {
  const app = express();
  app.use(express.json());
  app.use('/selection', require('../server/leihu')());
  const server = http.createServer(app);
  const wss = new WebSocket.Server({ server });
  wss.on('connection', queue.registerClient);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const ws = new WebSocket(base.replace('http:', 'ws:'));
  t.after(async () => {
    ws.terminate();
    wss.clients.forEach(client => client.terminate());
    await new Promise(resolve => server.close(resolve));
    wss.close();
  });
  await new Promise(resolve => ws.once('message', resolve));
  const get = () => fetch(base + '/selection').then(r => r.json());
  const post = (song, expectedRevision) => fetch(base + '/selection', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ song, expectedRevision }),
  });
  const initial = await get();
  queue.addSong({ title: '目前歌曲', requester: 'first' });
  queue.addSong({ title: '下一首', artist: '歌手', key: -2, requester: 'viewer' });
  const before = await get();
  assert.notEqual(before.revision, initial.revision);
  const broadcast = new Promise(resolve => {
    const onMessage = raw => {
      const state = JSON.parse(raw);
      if (state.nowPlaying?.leihuId === 'next') { ws.off('message', onMessage); resolve(state); }
    };
    ws.on('message', onMessage);
  });
  const selected = { id: 'next', title: '下一首', artist: '歌手' };
  assert.equal((await post(selected, initial.revision)).status, 409);
  assert.equal((await post(selected, before.revision)).status, 200);
  const pushed = await broadcast;
  assert.equal(pushed.nowPlaying.requester, 'viewer');
  assert.equal(pushed.nowPlaying.key, '-2');
  assert.deepEqual(pushed.queue.map(s => s.title), ['目前歌曲']);
  const after = await get();
  assert.equal((await post(selected, after.revision)).status, 200);
  assert.equal((await get()).revision, after.revision);
  assert.equal(queue.getState().queue.length, 1);
  assert.equal((await post({ id: 'new', title: '新歌' }, after.revision)).status, 200);
  assert.equal(queue.getState().nowPlaying.title, '新歌');
  assert.equal(queue.getState().nowPlaying.requester, 'leihu');
  assert.equal(queue.getState().queue.length, 2);
  assert.equal((await post({ id: 'bad', title: ' ' }, (await get()).revision)).status, 400);
  queue.skipSong();
  assert.equal((await get()).nowPlaying.title, '下一首');
  queue.clearQueue();
  assert.equal((await get()).nowPlaying, null);
});

test('external selection reuses pending and played entries and stabilizes revisions', () => {
  queue.clearQueue();
  queue.addPending({ title: 'Pending import', artist: 'Artist', requester: 'pending-viewer' });
  queue.selectSong({ id: 'pending-song', title: 'Pending import', artist: 'Artist' });
  assert.equal(queue.getState().nowPlaying.requester, 'pending-viewer');
  assert.equal(queue.getState().pending.some(song => song.title === 'Pending import'), false);
  queue.skipSong();
  queue.selectSong({ id: 'pending-song', title: 'Pending import', artist: 'Artist' });
  assert.equal(queue.getState().nowPlaying.requester, 'pending-viewer');
  assert.equal(queue.getState().playedSongs.some(song => song.title === 'Pending import'), false);
  assert.equal(queue.getState().nowPlaying.playedAt, undefined);
  const revision = queue.getSelectionState().revision;
  queue.addSong({ title: 'Only queued', requester: 'another-viewer' });
  assert.equal(queue.getSelectionState().revision, revision);
  queue.selectSong({ id: 'pending-song', title: 'Pending import', artist: 'Artist' });
  assert.equal(queue.getSelectionState().revision, revision);
  queue.clearQueue();
});
