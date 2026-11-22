const MAX_QUEUE = 3;
const MAX_HELD = 10;   // while a mode holds clips (modes.js), e.g. during a song
// Extra wait on top of an item's expected length before the server stops
// waiting for the clip player (e.g. none is open) and moves on by itself.
const WATCHDOG_GRACE_MS = 15000;
const YOUTUBE_MAX_MS = 10 * 60 * 1000; // matches the clip player's YouTube cap

let queue = [];
let current = null; // item on screen, or null when idle
let nextId = 0;
let watchdog = null;
let broadcast = null;
let held = false;   // true: nothing new starts; the queue waits
// Queued items carry queueId / queuedAt; what waits while held is shown in the dashboard's top bar,
// where it can play now or be dropped. onDrop (by queueId): an item that won't play hands back what
// it took (a !tk roll's names go back on the !tk list)
let nextQueueId = 0;
const drops = new Map();
let onWaiting = () => {};

function init(broadcastRaw) {
  broadcast = broadcastRaw;
}

function expectedDurationMs(payload) {
  if (payload.kind === 'youtube') return YOUTUBE_MAX_MS;
  if (payload.kind === 'sponsor-card') {
    // !tk: one list; !endingtk: groups, each starting on a new page under its heading
    const groups = payload.groups || [{ people: payload.broadcasters || [] }];
    const pages = groups.reduce((n, g) => n + Math.ceil(g.people.length / 4), 0);
    return 2000 + pages * 11000 + groups.length * 1500; // a page shows at most ~10.5s, a heading change 1.2s
  }
  return ((payload.duration || 30) + 3) * 1000;
}

function play(payload) {
  current = { ...payload, mediaId: ++nextId };
  broadcast(current);
  clearTimeout(watchdog);
  watchdog = setTimeout(() => {
    console.warn(`[media-queue] No end signal for "${current.title}" — moving on`);
    advance();
  }, expectedDurationMs(current) + WATCHDOG_GRACE_MS);
}

function advance() {
  clearTimeout(watchdog);
  watchdog = null;
  current = null;
  if (held) {
    if (queue.length) console.log(`[media-queue] Holding ${queue.length} until the mode changes`);
  } else if (queue.length > 0) {
    const next = queue.shift();
    drops.delete(next.queueId);
    play(next);
    console.log(`[media-queue] Playing next: "${next.title}" (${queue.length} remaining)`);
    notify();
  } else {
    console.log('[media-queue] Queue empty');
  }
}

// onDrop: runs if the item is dropped instead of played (queue full, ✕ Drop, !stop)
function enqueue(payload, { onDrop } = {}) {
  if (!current && !held) {
    play(payload);
    console.log(`[media-queue] Playing: "${payload.title}"`);
    return;
  }
  const max = held ? MAX_HELD : MAX_QUEUE;
  if (queue.length >= max) {
    console.log(`[media-queue] Queue full (${max}/${max}), dropping: "${payload.title}"`);
    if (onDrop) onDrop();
    return;
  }
  const item = { ...payload, queueId: ++nextQueueId, queuedAt: Date.now() };
  if (onDrop) drops.set(item.queueId, onDrop);
  queue.push(item);
  console.log(`[media-queue] Queued (${queue.length}/${max})${held ? ' — held' : ''}: "${payload.title}"`);
  notify();
}

// Where a queued item came from, for the dashboard
function from(item) {
  if (item.kind === 'sponsor-card') return item.groups ? '!endingtk' : '!tk';
  if (item.labelKey === 'shoutout') return '!so';
  return '!watch';
}

// What waits while a mode holds clips (nothing otherwise: a short queue plays by itself)
function waiting() {
  if (!held) return [];
  return queue.map(i => ({ id: i.queueId, title: i.title, from: from(i), at: i.queuedAt }));
}

function notify() {
  try { onWaiting(waiting()); } catch (err) { console.error('[media-queue] Could not tell the dashboards:', err.message); }
}

// `fn(waiting())` runs whenever that changes
function setWaitingListener(fn) {
  onWaiting = fn || onWaiting;
}

// ▶ Play now (dashboard): this queued item plays at once, held or not. → false when it's gone
function playQueued(id) {
  const i = queue.findIndex(q => q.queueId === id);
  if (i < 0) return false;
  const [item] = queue.splice(i, 1);
  drops.delete(item.queueId);
  playNow(item);
  notify();
  return true;
}

// ✕ Drop (dashboard): this queued item won't play. → false when it's gone
function dropQueued(id) {
  const i = queue.findIndex(q => q.queueId === id);
  if (i < 0) return false;
  const [item] = queue.splice(i, 1);
  const onDrop = drops.get(item.queueId);
  drops.delete(item.queueId);
  console.log(`[media-queue] Dropped: "${item.title}"`);
  if (onDrop) onDrop();
  notify();
  return true;
}

// A second clip player (e.g. OBS plus a preview tab) reports the same item
// ending; matching on mediaId stops that duplicate from skipping the next one.
// A missing id comes from a clip player page loaded before this change.
function onEnded(mediaId) {
  if (!current) return;
  if (mediaId != null && mediaId !== current.mediaId) return;
  advance();
}

function stopAll() {
  const had = queue.length;
  for (const item of queue) {
    const onDrop = drops.get(item.queueId);
    if (onDrop) onDrop();
  }
  drops.clear();
  queue = [];
  clearTimeout(watchdog);
  watchdog = null;
  current = null;
  broadcast({ type: 'media-stop' });
  console.log(`[media-queue] Stopped and cleared (dropped ${had} queued)`);
  notify();
}

// Raid with the ending roll (ending-raid.js): this plays at once — over what plays now (it stops) and
// while held; the queue waits. → its mediaId
function playNow(payload) {
  if (current) broadcast({ type: 'media-stop' });
  play(payload);
  console.log(`[media-queue] Playing now: "${payload.title}"`);
  return current.mediaId;
}

// Stops this item if it's still on screen; the next one plays (unless held)
function stopIf(mediaId) {
  if (!current || current.mediaId !== mediaId) return;
  broadcast({ type: 'media-stop' });
  advance();
}

// Holding: what plays now finishes, new items wait (up to MAX_HELD); letting go plays them in turn
function setHold(on) {
  held = !!on;
  if (!held && !current && queue.length) advance();
  notify();
}

const isHeld = () => held;

module.exports = { init, enqueue, playNow, stopIf, onEnded, stopAll, setHold, isHeld, waiting, setWaitingListener, playQueued, dropQueued };
