// server/alerts.js
// 🔔 Alerts on stream (overlay/alerts.html), instead of Streamlabs' Alert Box: follows, subs, gifts,
// cheers and raids, from the chat log's records (chat-log.js); redemptions are reward effects'. Each kind
// has its own settings — on/off, a minimum, how long it shows, a picture / GIF / video and a sound from
// the alert-media folder — and a "big" version from an amount up (raid ≥ 50 viewers, ≥ 10 gifts…).
// A gift of several subs is one alert (Twitch's line for each gift in it is left out). The overlay
// words them in the overlay language and shows one at a time. Settings are kept in alerts.json.
// The sound '@chime' is the overlay's own built-in chime (no file), the default for every kind.

const fs = require('fs');
const path = require('path');
const { UserError } = require('./messages');

const FILE = process.env.ALERTS_FILE || path.join(__dirname, '..', 'alerts.json');                   // tests use a temp file
const MEDIA_DIR = process.env.ALERT_MEDIA_DIR || path.join(__dirname, '..', 'alert-media');
const MEDIA = /\.(png|gif|jpe?g|webp|apng|mp4|webm|mp3|wav|ogg|m4a)$/i;
const RECENT_MAX = 20;
const CHIME = '@chime';

const KINDS = ['follow', 'sub', 'gift', 'cheer', 'raid'];
// The amount the minimum and the big version go by (none for follows and redemptions)
const AMOUNT = { sub: 'months', gift: 'count', cheer: 'bits', raid: 'viewers' };
const SUB_NOTICES = ['sub', 'resub', 'gift_paid_upgrade', 'prime_paid_upgrade', 'pay_it_forward'];

const kind = (on, seconds, extra = {}) => ({ on, min: 0, seconds, image: '', sound: CHIME, volume: 80, bigAt: 0, bigSeconds: 10, bigImage: '', bigSound: '', ...extra });
const DEFAULTS = {
  follow: kind(true, 5),
  sub: kind(true, 7, { bigAt: 12 }),
  gift: kind(true, 7, { bigAt: 10 }),
  cheer: kind(true, 7, { min: 1, bigAt: 1000 }),
  raid: kind(true, 8, { min: 1, bigAt: 50 }),
};
const LIMITS = { min: [0, 1e6], seconds: [2, 60], volume: [0, 100], bigAt: [0, 1e6], bigSeconds: [2, 60] };

let data = load();
let send = () => {};
let recent = [];
let followed = new Set();   // a follow alerts once per run (unfollow + follow again doesn't)
let nextId = 1;

function load() {
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch {}
  const kinds = {};
  for (const k of KINDS) kinds[k] = { ...DEFAULTS[k], ...(saved.kinds && saved.kinds[k]) };
  return { kinds };
}

function save() {
  try { fs.writeFileSync(FILE, JSON.stringify(data, null, 1)); } catch (err) { console.error('[alerts] Could not save alerts.json:', err.message); }
}

function init(sendFn) {
  send = sendFn;
}

// Picture / GIF / video / sound files in the alert-media folder
function files() {
  try { return fs.readdirSync(MEDIA_DIR).filter(f => MEDIA.test(f) && !f.startsWith('.')).sort(); } catch { return []; }
}

function status() {
  return { kinds: data.kinds, files: files(), folder: MEDIA_DIR, recent };
}

// { kinds?: { follow?: { on?, min?, … } } }
function update(updates) {
  const have = files();
  for (const [k, changes] of Object.entries(updates.kinds || {})) {
    if (!KINDS.includes(k) || !changes || typeof changes !== 'object') throw new UserError('alertBadSetting', {}, `unknown alert kind ${k}`);
    const next = { ...data.kinds[k] };
    for (const [key, value] of Object.entries(changes)) {
      if (key === 'on') next.on = !!value;
      else if (LIMITS[key]) {
        const n = Number(value);
        if (!Number.isFinite(n) || n < LIMITS[key][0] || n > LIMITS[key][1]) throw new UserError('alertBadSetting', {}, `${k}.${key} must be from ${LIMITS[key][0]} to ${LIMITS[key][1]}`);
        next[key] = Math.round(n);
      } else if (['image', 'sound', 'bigImage', 'bigSound'].includes(key)) {
        if (value && value !== CHIME && !have.includes(String(value))) throw new UserError('alertBadSetting', {}, `${value} is not in the alert-media folder`);
        next[key] = value ? String(value) : '';
      } else {
        throw new UserError('alertBadSetting', {}, `unknown setting ${k}.${key}`);
      }
    }
    data.kinds[k] = next;
  }
  save();
  return status();
}

// The alert for a chat-log record, or null
function alertFor(rec) {
  if (!rec) return null;
  if (rec.kind === 'follow') {
    const who = rec.user.id || rec.user.login;
    if (followed.has(who)) return null;
    followed.add(who);
    return { kind: 'follow' };
  }
  if (rec.kind === 'chat' && rec.bits) return { kind: 'cheer', bits: rec.bits };
  if (rec.kind !== 'notice') return null;
  if (SUB_NOTICES.includes(rec.notice)) return { kind: 'sub', notice: rec.notice, months: rec.months || 0, tier: rec.tier || '' };
  if (rec.notice === 'sub_gift' && !rec.communityGift) return { kind: 'gift', count: 1, tier: rec.tier || '', recipient: rec.recipient ? rec.recipient.name : '' };
  if (rec.notice === 'community_sub_gift') return { kind: 'gift', count: rec.count || 1, tier: rec.tier || '' };
  if (rec.notice === 'raid') return { kind: 'raid', viewers: rec.viewers || 0, avatar: rec.avatar || '' };
  return null;
}

// What the overlay shows: the event, its words' details, and how (from the kind's settings)
function build(a, rec, test) {
  const cfg = data.kinds[a.kind];
  const amount = AMOUNT[a.kind] ? a[AMOUNT[a.kind]] || 0 : 0;
  if (!test && (!cfg.on || amount < cfg.min)) return null;
  const big = cfg.bigAt > 0 && !!AMOUNT[a.kind] && amount >= cfg.bigAt;
  return {
    id: `a${Date.now()}-${nextId++}`, at: Date.now(), ...a,
    name: rec.anonymous ? '' : rec.user.name, anonymous: !!rec.anonymous,
    text: rec.kind === 'chat' ? (rec.parts || []).filter(p => p.t !== 'cheer').map(p => p.text).join('').trim() : rec.text || '',
    parts: rec.kind === 'chat' ? (rec.parts || []).filter(p => p.t !== 'cheer') : rec.parts || null,
    big,
    seconds: big ? cfg.bigSeconds : cfg.seconds,
    image: (big && cfg.bigImage) || cfg.image,
    sound: (big && cfg.bigSound) || cfg.sound,
    volume: cfg.volume,
    test: !!test,
  };
}

function show(alert) {
  recent = [alert, ...recent].slice(0, RECENT_MAX);
  send({ type: 'alert', alert });
  console.log(`[alerts] ${alert.test ? 'Test ' : ''}${alert.kind}${alert.big ? ' (big)' : ''}: ${alert.name || 'anonymous'}`);
  return alert;
}

// From the chat log: every new record (follows, notices, cheers, redemptions…)
function fromRecord(rec) {
  const a = alertFor(rec);
  const alert = a && build(a, rec, false);
  return alert ? show(alert) : null;
}

// A made-up one of this kind, on stream only (nothing is posted to Twitch)
function test(k, big) {
  if (!KINDS.includes(k)) throw new UserError('alertBadSetting', {}, `unknown alert kind ${k}`);
  const cfg = data.kinds[k];
  const amount = big ? Math.max(cfg.bigAt, 1) : Math.max(cfg.min, { sub: 3, gift: 1, cheer: 100, raid: 12 }[k] || 0);
  const a = { kind: k, [AMOUNT[k] || 'x']: amount };
  if (k === 'sub') Object.assign(a, { notice: amount > 1 ? 'resub' : 'sub', tier: '1000' });
  if (k === 'gift') a.tier = '1000';
  delete a.x;
  const text = { sub: 'love the stream!', cheer: 'Cheer!' }[k] || '';
  const rec = { kind: k === 'cheer' ? 'chat' : 'notice', user: { name: 'TestViewer' }, text, parts: text ? [{ t: 'text', text }] : [] };
  return show(build(a, rec, true));
}

function replay(id) {
  const old = recent.find(a => a.id === id) || recent[0];
  if (!old) return null;
  send({ type: 'alert', alert: { ...old, id: `a${Date.now()}-${nextId++}`, replay: true } });
  return old;
}

function skip() {
  send({ type: 'alert-skip' });
}

function _reset() { data = load(); recent = []; followed = new Set(); }

module.exports = { init, status, update, files, fromRecord, alertFor, test, replay, skip, MEDIA_DIR, KINDS, _reset };
