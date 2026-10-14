const { matchSong } = require('./matcher');
const { addSong, addPending } = require('./queue');
const { recordRequest } = require('./history');
const { pickRandom } = require('./random');

function handleRedemption(event) {
  if (!event) return;
  const requestText = event.user_input?.trim();
  const rewardId = event?.reward?.id;
  const requester = event?.user_name;

  console.log(`[twitch] Redemption from @${requester}: "${requestText}" (reward: ${rewardId})`);

  // ── Random song reward ──────────────────────────────────────────────────
  const randomRewardId = process.env.TWITCH_RANDOM_REWARD_ID;
  if (randomRewardId && rewardId === randomRewardId) {
    const { getState } = require('./queue');
    const { queue, nowPlaying } = getState();
    const excludeTitles = [
      ...(nowPlaying ? [nowPlaying.title] : []),
      ...queue.map(s => s.title),
    ];
    const picked = pickRandom(excludeTitles);
    if (picked) {
      addSong({ title: picked.title, artist: picked.artist, key: picked.key || '', requester });
      recordRequest({ title: picked.title, artist: picked.artist, requester });
      console.log(`[random] 🎲 Added "${picked.title}" for @${requester}`);
    } else {
      console.log(`[random] No eligible songs to pick from`);
    }
    return;
  }

  if (!process.env.TWITCH_REWARD_ID || rewardId !== process.env.TWITCH_REWARD_ID) return;

  // ── Regular song request ────────────────────────────────────────────────
  if (!requestText) {
    console.log('[webhook] Empty request text — no match attempted');
    return;
  }

  const result = matchSong(requestText);

  if (result.matched && result.confident) {
    // Strong match → straight to queue
    addSong({
      title: result.song.title,
      artist: result.song.artist,
      key: result.song.key || '',
      requester,
    });
    recordRequest({ title: result.song.title, artist: result.song.artist, requester });
    console.log(`[queue] ✓ Added "${result.song.title}" for @${requester} (${result.confidence}% match)`);

  } else if (result.matched && !result.confident) {
    // Weak match → pending for review
    addPending({
      title: result.song.title,
      artist: result.song.artist,
      requester,
      originalRequest: requestText,
      confidence: result.confidence,
    });
    console.log(`[queue] ⚠ Weak match "${result.song.title}" (${result.confidence}%) for @${requester} — sent to pending`);

  } else {
    // No match → pending for review (no auto-refund anymore)
    addPending({
      title: '',
      artist: '',
      requester,
      originalRequest: requestText,
      confidence: null,
    });
    console.log(`[queue] ✗ No match for "${requestText}" by @${requester} — sent to pending`);
  }
}

module.exports = { handleRedemption };
