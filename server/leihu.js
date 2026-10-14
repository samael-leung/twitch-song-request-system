const express = require('express');
const { getSelectionState, selectSong, linkCurrentSong } = require('./queue');

module.exports = function leihuRoutes() {
  const router = express.Router();
  router.get('/', (req, res) => res.json(getSelectionState()));
  router.post('/', (req, res) => {
    const { song, expectedRevision, action } = req.body || {};
    if (action != null && action !== 'link') return res.status(400).json({ error: 'Unsupported action' });
    if (!song || typeof song.id !== 'string' || !song.id.trim() ||
        typeof song.title !== 'string' || !song.title.trim() ||
        (song.artist != null && typeof song.artist !== 'string') ||
        (song.key != null && !['string', 'number'].includes(typeof song.key))) {
      return res.status(400).json({ error: 'song.id and song.title are required strings' });
    }
    if (expectedRevision !== getSelectionState().revision) {
      return res.status(409).json({ error: 'Playing selection changed; refresh and retry' });
    }
    if (action === 'link') {
      if (!linkCurrentSong(song.id.trim())) return res.status(409).json({ error: 'No current song to link' });
    } else selectSong({ ...song, id: song.id.trim(), title: song.title.trim() });
    res.json(getSelectionState());
  });
  return router;
};
