// shared/song-key.js — which song a title and artist name, for the request history (server/history.js,
// the random pick, the dashboard). Songs with the same title and different artists are different songs,
// as in the song list (sheets.js). A song or a row without an artist matches any artist.
(function (api) {
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.SongKey = api;
})((() => {
  const norm = s => String(s || '').toLowerCase().trim();

  // The key of a song's row: its title and artist
  const songKey = (title, artist) => `${norm(title)}|${norm(artist)}`;

  function sameSong(a, b) {
    if (norm(a.title) !== norm(b.title)) return false;
    const x = norm(a.artist), y = norm(b.artist);
    return x === y || !x || !y;
  }

  // The key in `rows` (key → { title, artist, last_requested_at }) for this song, or null. Without an exact
  // row, a row it matches (sameSong); of several, the one requested last.
  function findKey(rows, title, artist) {
    const key = songKey(title, artist);
    if (rows[key]) return key;
    const want = { title, artist };
    const hits = Object.keys(rows).filter(k => sameSong(rows[k], want));
    hits.sort((a, b) => String(rows[b].last_requested_at || '').localeCompare(String(rows[a].last_requested_at || '')));
    return hits[0] || null;
  }

  return { songKey, sameSong, findKey };
})());
