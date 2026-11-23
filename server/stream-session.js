// server/stream-session.js
// The stream session, for the Chat tab's "to announce" highlights: from when the stream went live
// (EventSub stream.online, no permission needed) until the next go-live. While offline the last
// stream's session stays, so a follow after the stream still waits to be thanked. If the server
// starts mid-stream, Helix /streams says when it went live. A stream that drops and comes back
// within SAME_SESSION_MS is a new broadcast on Twitch (and a new VOD) but the same session here, so
// "to announce" keeps who came before the drop. Kept in stream-session.json:
//   { startedAt (ms), live, endedAt (ms, when it was seen to end), lastLiveAt (ms, last seen live) }

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { ensureFreshToken } = require('./twitch');

const STATE_PATH = process.env.STREAM_SESSION_FILE || path.join(__dirname, '..', 'stream-session.json');   // tests use a temp file

const SAME_SESSION_MS = 15 * 60 * 1000;

let state = load();
let onChange = () => {};

function load() {
  try { return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')) || {}; } catch { return {}; }
}

function get() {
  return { startedAt: state.startedAt || null, live: !!state.live };
}

function set(next) {
  const before = get();
  state = { ...state, ...next };
  try { fs.writeFileSync(STATE_PATH, JSON.stringify(state)); } catch (err) { console.error('[stream-session] Could not save:', err.message); }
  const now = get();
  if (now.startedAt !== before.startedAt || now.live !== before.live) onChange(now);
}

// Live since `at`: a new session, or the one before when the stream only dropped for a moment.
// The end is when it was seen to end, or (an offline event missed while reconnecting) when it was
// last seen live; Twitch's offline event can also come after the new go-live, hence either side.
function wentLive(at) {
  const prev = state.startedAt;
  const ended = state.live ? state.lastLiveAt : state.endedAt;
  const same = !!prev && (at === prev || (!!ended && Math.abs(at - ended) < SAME_SESSION_MS));
  if (same && at !== prev) console.log(`[stream-session] Live again ${Math.max(0, Math.round((at - ended) / 1000))}s after the stream dropped — same session`);
  set({ startedAt: same ? prev : at, live: true, lastLiveAt: Date.now() });
}

function wentOffline() {
  if (state.live) set({ live: false, endedAt: Date.now() });
}

// stream.online / stream.offline
function onEvent(type, e) {
  if (type === 'stream.online') wentLive(Date.parse(e.started_at) || Date.now());
  else if (type === 'stream.offline') wentOffline();
}

// Live now? (on start, and after reconnecting: an online / offline event may have been missed)
async function refresh() {
  try {
    await ensureFreshToken();
    const { data } = await axios.get('https://api.twitch.tv/helix/streams', {
      headers: { 'Client-Id': process.env.TWITCH_CLIENT_ID, 'Authorization': `Bearer ${process.env.TWITCH_USER_ACCESS_TOKEN}` },
      params: { user_id: process.env.TWITCH_BROADCASTER_ID, type: 'live' },
      timeout: 10000,
    });
    const stream = data.data?.[0];
    if (stream) wentLive(Date.parse(stream.started_at) || state.startedAt || Date.now());
    else wentOffline();
  } catch (err) {
    console.error('[stream-session] Could not check whether the stream is live:', err.response?.data?.message || err.message);
  }
}

// `fn(session)` runs when the stream goes live or ends
function init(fn) {
  onChange = fn || onChange;
}

module.exports = { init, get, onEvent, refresh };
