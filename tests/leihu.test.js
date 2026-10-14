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
  const post = (song, expectedRevision, action) => fetch(base + '/selection', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ song, expectedRevision, action }),
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
  const canonical = { ...queue.getState().nowPlaying };
  const beforeLink = await get();
  const linked = await post({ id: 'corrected', title: 'Decorated YouTube title', artist: 'Different metadata' }, beforeLink.revision, 'link');
  assert.equal(linked.status, 200);
  assert.deepEqual(queue.getState().nowPlaying, { ...canonical, leihuId: 'corrected' });
  assert.equal(queue.getState().queue.length, 2);
  const linkRevision = (await get()).revision;
  assert.equal((await post({ id: 'corrected', title: 'Another display name' }, linkRevision, 'link')).status, 200);
  assert.equal((await get()).revision, linkRevision);
  assert.equal((await post({ id: 'stale', title: 'Stale' }, beforeLink.revision, 'link')).status, 409);
  assert.equal((await post({ id: 'unsupported', title: 'Unsupported' }, linkRevision, 'unsupported')).status, 400);
  assert.equal((await post({ id: 'bad', title: ' ' }, (await get()).revision)).status, 400);
  queue.skipSong();
  assert.equal((await get()).nowPlaying.title, '下一首');
  queue.clearQueue();
  assert.equal((await get()).nowPlaying, null);
  assert.equal((await post({ id: 'empty', title: 'Nothing' }, (await get()).revision, 'link')).status, 409);
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

test('merged upstream candidates, redraw and drag-to-pending retain Leihu synchronization', () => {
  queue.clearQueue();
  queue.addPending({ title: '', requester: 'candidate-viewer', originalRequest: '同名曲', candidates: [
    { title: '同名曲', artist: 'A', key: '2' }, { title: '同名曲', artist: 'B', key: '-3' },
  ] });
  queue.selectSong({ id: 'artist-b', title: '同名曲', artist: 'B' });
  let state = queue.getState();
  assert.equal(state.nowPlaying.requester, 'candidate-viewer');
  assert.equal(state.nowPlaying.key, '-3');
  assert.equal(state.pending.some(entry => entry.originalRequest === '同名曲'), false);
  queue.moveSong('nowPlaying', 0, 'pending', 0);
  assert.equal(queue.getState().pending[0].leihuId, 'artist-b');
  queue.selectSong({ id: 'artist-b', title: '同名曲', artist: 'B' });
  assert.equal(queue.getState().pending.length, 0);
  const before = queue.getSelectionState().revision;
  queue.redrawSong('nowPlaying', 0, { title: 'Redrawn', artist: 'C', key: 1, requester: 'candidate-viewer' });
  assert.notEqual(queue.getSelectionState().revision, before);
  assert.equal(queue.getState().nowPlaying.isRandom, true);
  queue.selectSong({ id: 'redrawn', title: 'Redrawn', artist: 'C' });
  assert.equal(queue.getState().nowPlaying.isRandom, true);
  queue.addPending({ requester: 'picker', candidates: [{ title: 'Choice 1' }, { title: 'Choice 2', key: '4' }] });
  assert.equal(queue.acceptPending(0, undefined, undefined, 1), true);
  assert.equal(queue.getState().queue.at(-1).title, 'Choice 2');
  assert.equal(queue.getState().queue.at(-1).key, '4');
  queue.clearQueue();
});
