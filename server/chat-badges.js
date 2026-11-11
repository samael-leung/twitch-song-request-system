// server/chat-badges.js
// Badge pictures for the on-stream chat (overlay/chat.html): Twitch's global badges and the
// channel's own (sub months, bits tiers), read once and kept until the server restarts
// (Helix GET /chat/badges/global and /chat/badges). Chat records name each badge as
// "set/version" (`user.badgeIds`, chat-log.js); this maps those to a picture.

const axios = require('axios');
const { ensureFreshToken } = require('./twitch');

const API = 'https://api.twitch.tv/helix';
const RETRY_MS = 5 * 60000;   // after a failed read, try again on the next request this long after

let badges = null;
let loading = null;
let failedAt = 0;

// Helix badge sets → { "set/version": picture URL }; the channel's own replace the global ones
function toMap(globalSets, channelSets) {
  const map = {};
  for (const set of [...(globalSets || []), ...(channelSets || [])]) {
    for (const v of set.versions || []) map[`${set.set_id}/${v.id}`] = v.image_url_2x || v.image_url_1x;
  }
  return map;
}

async function read() {
  await ensureFreshToken();
  const headers = { 'Client-Id': process.env.TWITCH_CLIENT_ID, 'Authorization': `Bearer ${process.env.TWITCH_USER_ACCESS_TOKEN}` };
  const broadcaster = process.env.TWITCH_BROADCASTER_ID;
  const [global, channel] = await Promise.all([
    axios.get(`${API}/chat/badges/global`, { headers, timeout: 10000 }),
    broadcaster ? axios.get(`${API}/chat/badges`, { headers, params: { broadcaster_id: broadcaster }, timeout: 10000 }) : { data: { data: [] } },
  ]);
  return toMap(global.data.data, channel.data.data);
}

// { "set/version": url }; {} while Twitch can't be reached (the chat shows without badges)
async function get() {
  if (badges) return badges;
  if (!loading) {
    if (Date.now() - failedAt < RETRY_MS) return {};
    loading = read()
      .then((map) => { badges = map; return map; })
      .catch((err) => {
        failedAt = Date.now();
        console.error('[chat-badges] Could not read the badge pictures:', err.response?.data?.message || err.message);
        return {};
      })
      .finally(() => { loading = null; });
  }
  return loading;
}

module.exports = { get, toMap };
