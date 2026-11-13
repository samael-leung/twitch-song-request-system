// server/ending-raid.js
// 🚀 Raid with the ending roll (🛡 Moderate → Raid, "with the ending roll"): the !endingtk roll plays
// so that the raid goes 10 seconds after it ends. Twitch sends a raid 90 s after it's started and the
// roll's length is known from its pages (ending-credits.rollMs), so either the raid starts now and the
// roll later (a roll under 80 s), or the roll now and the raid later. The roll cuts in on time, over a
// clip or while clips are held. Someone raiding us meanwhile stops both, and so does Cancel.

const chatMod = require('./chat-mod');
const credits = require('./ending-credits');
const mediaQueue = require('./media-queue');
const { pickBgUrl } = require('./commands/thanks');
const { UserError, errorBody } = require('./messages');

const RAID_MS = 90000;   // Twitch's countdown before a raid goes
const GAP_MS = 10000;    // from the roll's end to the raid
const LINGER_MS = 15000; // after the raid goes, before this run is forgotten

let run = null;   // { login, name, startedAt, rollAt, raidAt, landsAt, rollMs, people, groups, raidStarted, mediaId, timers }
let send = () => {};

function init(sendFn) {
  send = sendFn;
}

// When each part happens, from now (ms): the roll (null: nobody to thank), the raid's start, the raid going
function timeline(rollMs) {
  if (!rollMs) return { rollIn: null, raidIn: 0, landsIn: RAID_MS };
  const raidIn = Math.max(0, rollMs + GAP_MS - RAID_MS);
  return { rollIn: raidIn + RAID_MS - GAP_MS - rollMs, raidIn, landsIn: raidIn + RAID_MS };
}

const count = groups => groups.reduce((n, g) => n + g.people.length, 0);

// Before the second click: where the viewers would go, and when the roll and the raid would go
async function plan(login) {
  const ch = await chatMod.channel(login);
  const groups = await credits.gather();
  const rollMs = credits.rollMs(groups);
  return { ...ch, people: count(groups), rollMs, ...timeline(rollMs) };
}

function status() {
  if (!run) return null;
  const { login, name, startedAt, rollAt, raidAt, landsAt, rollMs, people, raidStarted, mediaId } = run;
  return { login, name, startedAt, rollAt, raidAt, landsAt, rollMs, people, raidStarted, rolling: mediaId != null };
}

const update = (extra = {}) => send({ type: 'ending-raid', run: status(), ...extra });

async function start(login) {
  if (run) throw new UserError('modRaidBusy', {}, 'A raid is already on its way — cancel it first.');
  const user = await chatMod.lookupUser(login);
  if (user.id === String(process.env.TWITCH_BROADCASTER_ID)) throw new UserError('modRaidSelf', {}, 'You can\'t raid your own channel.');
  const groups = await credits.gather();
  await credits.addAvatars(groups);
  const rollMs = credits.rollMs(groups);
  const tl = timeline(rollMs);
  const t0 = Date.now();
  if (tl.raidIn === 0) await chatMod.raid(user.login);   // a refusal stops here, before anything plays
  if (run) throw new UserError('modRaidBusy', {}, 'A raid is already on its way — cancel it first.');
  run = {
    login: user.login, name: user.name, startedAt: t0, rollMs, people: count(groups), groups,
    rollAt: tl.rollIn == null ? null : t0 + tl.rollIn, raidAt: t0 + tl.raidIn, landsAt: t0 + tl.landsIn,
    raidStarted: tl.raidIn === 0, mediaId: null, timers: [],
  };
  const r = run;
  const later = (ms, fn) => r.timers.push(setTimeout(() => { if (run === r) fn(); }, ms));
  if (tl.rollIn != null) later(tl.rollIn, playRoll);
  if (tl.raidIn > 0) later(tl.raidIn, raidNow);
  later(tl.landsIn + LINGER_MS, () => { clearTimers(); run = null; update(); });
  console.log(`[ending-raid] Raiding ${r.name}: ${rollMs ? `roll (${Math.round(rollMs / 1000)} s) in ${Math.round(tl.rollIn / 1000)} s, ` : 'nobody to thank, '}raid starts in ${Math.round(tl.raidIn / 1000)} s, goes in ${Math.round(tl.landsIn / 1000)} s`);
  update();
  return status();
}

function playRoll() {
  credits.saveRunAt(Date.now());
  run.mediaId = mediaQueue.playNow({ type: 'media', kind: 'sponsor-card', title: 'Ending Roll', bgUrl: pickBgUrl(), groups: run.groups });
  console.log(`[ending-raid] Playing the ending roll (${run.people} people)`);
  update();
}

async function raidNow() {
  const r = run;
  try {
    await chatMod.raid(r.login);
    if (run !== r) return chatMod.cancelRaid().catch(() => {});   // stopped while Twitch was asked
    r.raidStarted = true;
    update();
  } catch (err) {
    console.error('[ending-raid] Could not start the raid:', err.message);
    if (run !== r) return;
    clearTimers();
    run = null;
    update({ error: errorBody(err) });   // the roll plays on: the thanks still stand
  }
}

function clearTimers() {
  if (run) for (const t of run.timers) clearTimeout(t);
}

// Cancel (reason 'canceled') or someone raiding us ('raided', by = their name): the raid and the roll stop
async function stop(reason = 'canceled', by = '') {
  if (!run) throw new UserError('modNoRaid', {}, 'There\'s no raid to cancel (it may have gone already).');
  const r = run;
  clearTimers();
  run = null;
  if (r.mediaId != null) mediaQueue.stopIf(r.mediaId);
  let canceled = !r.raidStarted;
  if (r.raidStarted && Date.now() < r.landsAt) {
    try { await chatMod.cancelRaid(); canceled = true; } catch (err) { console.error('[ending-raid] Could not cancel the raid:', err.message); }
  }
  console.log(`[ending-raid] Stopped (${reason}${by ? ` by ${by}` : ''}): raid ${canceled ? 'canceled' : 'not canceled'}${r.mediaId != null ? ', roll stopped' : ''}`);
  update({ stopped: reason, by, canceled });
  return { ok: true, canceled };
}

// Chat-log records: a raid coming in while ours waits stops it
function onRecord(rec) {
  if (!run || !rec || rec.kind !== 'notice' || rec.notice !== 'raid' || Date.now() >= run.landsAt) return;
  stop('raided', rec.user && rec.user.name).catch(() => {});
}

const active = () => !!run;

module.exports = { init, timeline, plan, start, stop, status, onRecord, active, RAID_MS, GAP_MS };
