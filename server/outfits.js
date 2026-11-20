// server/outfits.js
// 👕 Outfits: channel-point rewards that change the PNGtuber's outfit in veadotube (veadotube.js).
// A redemption of one of OUTFIT_REWARDS waits in the dashboard, which shows the outfits (the
// avatar states) to pick from; the pick is set in veadotube and the redemption marked done (only
// for rewards the app manages). With OUTFIT_MINUTES, the outfit goes back to OUTFIT_DEFAULT after
// that long; 0 = it stays until the next one. The outfit window is the one that has OUTFIT_DEFAULT
// (other windows, e.g. a second avatar, are left alone). When more windows have it (the same avatar
// twice), it's the one ☆ was pressed in; veadotube gives windows new IDs on every launch, so then
// ☆ is needed again once.

const veadotube = require('./veadotube');
const redemptions = require('./redemptions');
const { UserError } = require('./messages');

const MAX_MINUTES = 24 * 60;
const MAX_PENDING = 20;

let broadcast = () => {};
let writeEnv = () => {};
let pending = [];        // [{ id, rewardId, reward, user, at }], oldest first
let revert = null;       // { at, timer }
let chosenWindow = '';   // the window ☆ was pressed in

function settings() {
  const minutes = Number(process.env.OUTFIT_MINUTES);
  return {
    rewards: (process.env.OUTFIT_REWARDS || '').split(',').map(s => s.trim()).filter(Boolean),
    default: process.env.OUTFIT_DEFAULT || '',
    minutes: Number.isInteger(minutes) && minutes > 0 ? Math.min(minutes, MAX_MINUTES) : 0,
  };
}

function candidates() {
  const def = settings().default;
  return def ? veadotube.windowsWith(def) : [];
}

function outfitWindow() {
  const all = candidates();
  return all.find(w => w.id === chosenWindow) || (all.length === 1 ? all[0] : undefined);
}

function status() {
  const w = outfitWindow();
  return {
    ...settings(),
    windows: veadotube.list(),
    window: w ? w.id : '',
    unsure: !w && candidates().length > 1,   // more windows have the default: ☆ in the outfit window
    pending,
    revertAt: revert ? revert.at : 0,
  };
}

const changed = () => broadcast({ type: 'outfits', ...status() });

function init({ send, saveEnv }) {
  broadcast = send;
  writeEnv = saveEnv;
  veadotube.start(changed);
}

function clearRevert() {
  if (revert) clearTimeout(revert.timer);
  revert = null;
}

function startRevert() {
  clearRevert();
  const { minutes, default: def } = settings();
  if (!minutes || !def) return;
  const ms = minutes * 60000;
  revert = {
    at: Date.now() + ms,
    timer: setTimeout(() => {
      revert = null;
      const w = outfitWindow();
      if (w && veadotube.set(w.id, def)) console.log(`[outfits] Time's up: back to ${def}`);
      else console.warn(`[outfits] Time's up, but veadotube has no ${def} now`);
      changed();
    }, ms),
  };
}

// From the Twitch redemption handler: true when it was an outfit reward
function onRedemption(event) {
  const rewardId = event?.reward?.id;
  if (!rewardId || !settings().rewards.includes(rewardId)) return false;
  pending.push({ id: event.id, rewardId, reward: event.reward.title || '', user: event.user_name || event.user_login || '', at: Date.now() });
  pending = pending.slice(-MAX_PENDING);
  console.log(`[outfits] ${event.user_name} redeemed ${event.reward.title}: waiting for an outfit pick`);
  changed();
  return true;
}

// Sets an outfit, in the outfit window (or the window it was clicked in, before there is one). For a
// waiting redemption (id): it's marked done and the time limit starts; picked by hand: no time limit
// (a running one stops).
function pick(state, id, windowId) {
  const all = veadotube.windowsWith(state);
  const ow = outfitWindow();
  const w = all.find(x => x.id === windowId) || all.find(x => x === ow) || (all.length === 1 ? all[0] : undefined);
  if (!w) throw new UserError('outfitNotFound', { state }, `veadotube has no outfit "${state}" now — is it running?`);
  const p = id ? pending.find(x => x.id === id) : null;
  if (id && !p) throw new UserError('redemptionHandled', {}, 'This redemption was already done or refunded');
  veadotube.set(w.id, state);
  if (p) {
    pending = pending.filter(x => x !== p);
    redemptions.settle({ id: p.id, rewardId: p.rewardId }, 'done');
    if (state === settings().default) clearRevert(); else startRevert();
  } else if (!ow || w === ow) {
    clearRevert();   // a click in another window leaves the outfit's time limit running
  }
  console.log(`[outfits] Outfit: ${state}${p ? ` (for ${p.user})` : ''}`);
  changed();
}

// Refund (only for rewards the app manages), or just take it off the list
function drop(id, refund) {
  const p = pending.find(x => x.id === id);
  if (!p) return;
  pending = pending.filter(x => x !== p);
  if (refund) redemptions.settle({ id: p.id, rewardId: p.rewardId }, 'refund');
  changed();
}

// Keep the outfit on: stop the time limit
function keep() {
  clearRevert();
  changed();
}

// { rewards?: [id], default?: state, window?: id (where ☆ was pressed), minutes?: n }
function save(updates) {
  if (updates.window !== undefined) chosenWindow = String(updates.window);
  const values = {};
  if (updates.rewards !== undefined) {
    if (!Array.isArray(updates.rewards)) throw new UserError('outfitBadSetting', {}, 'rewards must be a list');
    values.OUTFIT_REWARDS = updates.rewards.map(String).filter(s => /^[\w-]+$/.test(s)).join(',');
  }
  if (updates.default !== undefined) values.OUTFIT_DEFAULT = String(updates.default).replace(/[\r\n]/g, '');
  if (updates.minutes !== undefined) {
    const n = Number(updates.minutes);
    if (!Number.isInteger(n) || n < 0 || n > MAX_MINUTES) throw new UserError('outfitBadSetting', {}, `minutes must be a whole number from 0 to ${MAX_MINUTES}`);
    values.OUTFIT_MINUTES = String(n);
  }
  writeEnv(values);
  Object.assign(process.env, values);
  if (values.OUTFIT_MINUTES === '0') clearRevert();   // a running time limit otherwise runs out as it was
  changed();
  return status();
}

function thumb(windowId, state) {
  return veadotube.thumb(windowId, state);
}

function _reset() { pending = []; chosenWindow = ''; clearRevert(); }

module.exports = { init, status, settings, onRedemption, pick, drop, keep, save, thumb, _reset };
