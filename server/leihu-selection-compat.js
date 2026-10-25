'use strict';
// Compatibility API for Leihu Singsing. Keep the existing leihu.js integration.
const { randomUUID, createHash } = require('node:crypto');

module.exports = function installSelection(app, dependencies = {}) {
  const queue = dependencies.queue || require('./queue');
  const leihu = dependencies.leihu || require('./leihu');
  for (const name of ['getState', 'moveSong', 'addSong', 'broadcastRaw']) {
    if (typeof queue[name] !== 'function') throw new Error(`Unsupported queue API: ${name}`);
  }
  const session = randomUUID();
  let revision = 0, lastEntry, lastHash;
  const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  function snapshot() {
    const state = queue.getState();
    if (!state || !Array.isArray(state.queue) || !Array.isArray(state.pending) || !Array.isArray(state.playedSongs)) {
      throw new Error('Unsupported queue state');
    }
    const current = state.nowPlaying || null;
    const hash = createHash('sha256').update(JSON.stringify(current)).digest('hex');
    if (current !== lastEntry || hash !== lastHash) {
      lastEntry = current; lastHash = hash; revision++;
    }
    return { revision: `${session}:${revision}`, nowPlaying: current };
  }
  function matches(entry, song) {
    return entry && normalize(entry.title) === normalize(song.title)
      && (!song.artist || normalize(entry.artist) === normalize(song.artist));
  }
  function locate(song) {
    const state = queue.getState();
    const rows = [
      ...(state.nowPlaying ? [{ zone: 'nowPlaying', index: 0, entry: state.nowPlaying, choice: state.nowPlaying }] : []),
      ...state.queue.map((entry, index) => ({ zone: 'queue', index, entry, choice: entry })),
      ...state.pending.map((entry, index) => ({ zone: 'pending', index, entry, choice: entry })),
      ...state.playedSongs.map((entry, index) => ({ zone: 'played', index, entry, choice: entry })),
    ];
    const linked = rows.find(row => row.entry.leihuId === song.id);
    if (linked) return linked;
    const candidates = [];
    for (const row of rows) {
      if (matches(row.entry, song)) candidates.push(row);
      else if (row.zone === 'pending') {
        const choice = (row.entry.candidates || []).find(candidate => matches(candidate, song));
        if (choice) candidates.push({ ...row, choice });
      }
    }
    if (!song.artist && new Set(candidates.map(row => normalize(row.choice.artist))).size > 1) {
      const current = candidates.find(row => row.zone === 'nowPlaying');
      if (current) return current;
      const error = new Error('Multiple artists match; confirm the song in the request dashboard first.');
      error.status = 422; throw error;
    }
    return candidates[0];
  }
  function attach(song, publishUnchanged = false) {
    const current = queue.getState().nowPlaying;
    if (!current) { const error = new Error('No current song to link'); error.status = 409; throw error; }
    if (current.leihuId === song.id && !publishUnchanged) return;
    if (current.leihuId !== song.id && typeof leihu.setLink === 'function') leihu.setLink(current.title, current.artist || '', song.id);
    current.leihuId = song.id;
    if (queue.getState().nowPlaying?.leihuId !== song.id) throw new Error('Queue does not expose live song entries');
    queue.broadcastRaw({ type: 'state', ...queue.getState() });
  }
  function select(song) {
    const found = locate(song);
    if (found && found.zone !== 'nowPlaying') {
      if (!queue.moveSong(found.zone, found.index, 'nowPlaying', 0)) throw new Error('Could not promote requested song');
      const current = queue.getState().nowPlaying;
      if (found.zone === 'pending') {
        current.title = found.choice.title;
        current.artist = found.choice.artist || '';
        current.key = String(found.choice.key ?? found.entry.key ?? song.key ?? '');
        current.requester = found.entry.requester;
        current.addedAt = found.entry.addedAt;
        if (found.entry.isRandom) current.isRandom = true;
      }
      delete current.playedAt;
    } else if (!found) {
      const hadCurrent = !!queue.getState().nowPlaying;
      queue.addSong({ title: song.title.trim(), artist: song.artist || '', key: song.key ?? '', requester: 'leihu' });
      const state = queue.getState();
      if (hadCurrent && !queue.moveSong('queue', state.queue.length - 1, 'nowPlaying', 0)) {
        throw new Error('Could not select added song');
      }
    }
    attach(song, true);
  }
  const route = '/api/integrations/leihu/selection';
  app.get(route, (req, res) => {
    try { res.json(snapshot()); }
    catch (error) { res.status(500).json({ error: 'Queue compatibility check failed. Check the server log.' }); console.error('[leihu-sync]', error.message); }
  });
  app.post(route, (req, res) => {
    const origin = req.get('Origin');
    if (origin && origin !== `${req.protocol}://${req.get('host')}`) return res.status(403).json({ error: 'Cross-origin selection is not allowed' });
    if (!req.is('application/json')) return res.status(415).json({ error: 'JSON is required' });
    const { song, expectedRevision, action } = req.body || {};
    if (action != null && action !== 'link') return res.status(400).json({ error: 'Unsupported action' });
    if (!song || typeof song.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(song.id)
      || typeof song.title !== 'string' || !song.title.trim() || song.title.length > 2000
      || (song.artist != null && (typeof song.artist !== 'string' || song.artist.length > 500))
      || (song.key != null && !['string', 'number'].includes(typeof song.key))
      || (typeof song.key === 'number' && !Number.isFinite(song.key))) return res.status(400).json({ error: 'Invalid song' });
    try {
      if (expectedRevision !== snapshot().revision) return res.status(409).json({ error: 'Playing selection changed; refresh and retry' });
      if (action === 'link') attach(song); else select(song);
      res.json(snapshot());
    } catch (error) {
      console.error('[leihu-sync]', error.message);
      res.status(error.status || 500).json({ error: error.status ? error.message : 'Selection failed. Check the server log.' });
    }
  });
};
