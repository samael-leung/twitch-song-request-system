// server/app-log.js
// Every start of the song queue gets its own folder in logs/, named by when it started
// (YYYY-MM-DD_HH-MM-SS, local time), with what a bug report needs:
//   app.log    what the console shows, a time on each line
//   leihu.log  Leihu Singsing's output, when the song queue started it (leihu-launcher.js)
// Tokens, secrets and passwords are blanked before anything is written. The last 30 runs are kept,
// and any run from the last 14 days; older folders go at start.
// Chat logs stay in chat-logs/ (chat-log.js): the Chat tab and !endingtk read them back, across restarts.

const fs = require('fs');
const path = require('path');
const util = require('util');

const ROOT = process.env.APP_LOG_DIR || path.join(__dirname, '..', 'logs');   // tests use a temp folder
const KEEP_RUNS = 30;
const KEEP_DAYS = 14;
const RUN_NAME = /^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})(-\d+)?$/;
const HIDDEN = '[hidden]';

let dir = null;
let fd = null;
let hooked = false;

const pad = n => String(n).padStart(2, '0');
const stamp = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
const clock = d => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`;

// Values of .env settings named like a secret (tokens, the client secret, passwords, keys), as they are now
function secretValues() {
  return Object.entries(process.env)
    .filter(([name, value]) => /SECRET|TOKEN|PASSWORD|_KEY$|APIKEY/i.test(name) && value && value.length >= 8 && !/^\d+$/.test(value))
    .map(([, value]) => value);
}

// Anything that looks like a credential, blanked
function redact(text) {
  let out = String(text);
  for (const v of secretValues()) out = out.split(v).join(HIDDEN);
  return out
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, HIDDEN)
    .replace(/\b(oauth:)[a-z0-9]{10,}/gi, `$1${HIDDEN}`)
    .replace(/\b(Bearer|OAuth)\s+[\w.~+/-]{10,}=*/g, `$1 ${HIDDEN}`)
    .replace(/(["']?(?:access_token|refresh_token|client_secret|private_key|password|token)["']?\s*[:=]\s*["']?)[^"'\s&,}]{6,}/gi, `$1${HIDDEN}`)
    .replace(/([?&]code=)[^&\s]+/g, `$1${HIDDEN}`);
}

function write(level, args) {
  if (fd === null) return;
  const now = new Date();
  const text = redact(util.format(...args));
  const tag = level === 'log' || level === 'info' ? '' : ` ${level.toUpperCase()}`;
  const lines = text.split('\n').map((line, i) => (i ? '    ' : `${clock(now)}${tag} `) + line).join('\n');
  try { fs.writeSync(fd, lines + '\n'); } catch {}
}

// Run folders past what's kept: beyond the newest KEEP_RUNS and older than KEEP_DAYS
function prune(now = new Date()) {
  let names;
  try { names = fs.readdirSync(ROOT).filter(n => RUN_NAME.test(n)).sort().reverse(); } catch { return; }
  const cutoff = now.getTime() - KEEP_DAYS * 86400000;
  names.forEach((name, i) => {
    if (i < KEEP_RUNS || path.join(ROOT, name) === dir) return;
    const [, y, mo, d, h, mi, s] = name.match(RUN_NAME);
    if (new Date(+y, mo - 1, +d, +h, +mi, +s).getTime() >= cutoff) return;
    try { fs.rmSync(path.join(ROOT, name), { recursive: true, force: true }); } catch {}
  });
}

// Opens this run's folder and copies the console into it from now on
function start(now = new Date()) {
  if (dir) return dir;
  try {
    fs.mkdirSync(ROOT, { recursive: true });
    let name = stamp(now);
    for (let n = 2; fs.existsSync(path.join(ROOT, name)); n++) name = `${stamp(now)}-${n}`;
    dir = path.join(ROOT, name);
    fs.mkdirSync(dir);
    fd = fs.openSync(path.join(dir, 'app.log'), 'a');
  } catch (err) {
    dir = null;
    fd = null;
    console.warn('[app-log] Could not open the log folder:', err.message);
    return null;
  }
  if (!hooked) hook();
  prune(now);
  return dir;
}

function hook() {
  hooked = true;
  for (const level of ['log', 'info', 'warn', 'error']) {
    const original = console[level].bind(console);
    console[level] = (...args) => { original(...args); write(level, args); };
  }
  // A crash: written before Node prints it and exits
  process.on('uncaughtExceptionMonitor', (err, origin) => write('error', [`[${origin}]`, err]));
}

const current = () => dir;
const leihuLogPath = () => (dir ? path.join(dir, 'leihu.log') : null);

// Lets the tests start again with a clean slate (the console stays copied)
function _reset() {
  if (fd !== null) try { fs.closeSync(fd); } catch {}
  dir = null;
  fd = null;
}

module.exports = { start, current, leihuLogPath, redact, prune, ROOT, KEEP_RUNS, KEEP_DAYS, _reset };
