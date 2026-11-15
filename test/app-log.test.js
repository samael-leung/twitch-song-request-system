const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Run folders go to a temp folder, never the real logs/
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'app-log-'));
process.env.APP_LOG_DIR = tmp;
process.env.TWITCH_USER_ACCESS_TOKEN = 'abcdef1234567890tokenvalue';
process.env.TWITCH_USER_TOKEN_EXPIRES_AT = '1794757790120';
console.log = console.warn = console.error = () => {};
const appLog = require('../server/app-log');

test.after(() => { appLog._reset(); fs.rmSync(tmp, { recursive: true, force: true }); });

const run = (d) => {
  const pad = n => String(n).padStart(2, '0');
  const name = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  fs.mkdirSync(path.join(tmp, name));
  return name;
};

test('each start gets a folder named by its time; the console goes to its app.log, secrets blanked', () => {
  const dir = appLog.start(new Date(2026, 10, 16, 20, 5, 31));
  assert.strictEqual(path.basename(dir), '2026-11-16_20-05-31');
  assert.strictEqual(appLog.leihuLogPath(), path.join(dir, 'leihu.log'));
  console.log('[twitch] token abcdef1234567890tokenvalue refreshed');
  console.warn('[sheets] slow', { took: 3 });
  console.error(new Error('boom'));
  const log = fs.readFileSync(path.join(dir, 'app.log'), 'utf8');
  assert.match(log, /^\d\d:\d\d:\d\d\.\d{3} \[twitch\] token \[hidden\] refreshed$/m);
  assert.doesNotMatch(log, /abcdef1234567890tokenvalue/);
  assert.match(log, /WARN \[sheets\] slow \{ took: 3 \}/);
  assert.match(log, /ERROR Error: boom\n\s+at /);   // a stack's lines are indented under it

  // Started again the same second: its own folder
  appLog._reset();
  assert.strictEqual(path.basename(appLog.start(new Date(2026, 10, 16, 20, 5, 31))), '2026-11-16_20-05-31-2');
  console.log('once');
  assert.strictEqual(fs.readFileSync(path.join(appLog.current(), 'app.log'), 'utf8').match(/once/g).length, 1);
});

test('anything that looks like a credential is blanked', () => {
  const r = appLog.redact;
  assert.strictEqual(r('Authorization: Bearer abc.def-ghi_jkl123'), 'Authorization: Bearer [hidden]');
  assert.strictEqual(r('{"access_token":"x1y2z3w4v5","expires_in":3600}'), '{"access_token":"[hidden]","expires_in":3600}');
  assert.strictEqual(r('client_secret=s3cr3tvalue&grant_type=refresh_token'), 'client_secret=[hidden]&grant_type=refresh_token');
  assert.strictEqual(r('/callback?code=abc123&scope=chat'), '/callback?code=[hidden]&scope=chat');
  assert.strictEqual(r('key -----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY----- end'), 'key [hidden] end');
  assert.strictEqual(r('expires 1794757790120'), 'expires 1794757790120');   // a number isn't a secret
  assert.strictEqual(r('[queue] Added "Lemon" by Mika'), '[queue] Added "Lemon" by Mika');
});

test('the newest 30 runs and any from the last 14 days are kept', () => {
  appLog._reset();   // its app.log is open: Windows can't delete the folder until it's closed
  for (const name of fs.readdirSync(tmp)) fs.rmSync(path.join(tmp, name), { recursive: true });
  const now = new Date(2026, 10, 16, 12, 0, 0);
  const day = 86400000;
  const recent = Array.from({ length: 35 }, (_, i) => run(new Date(now - i * 3600000)));   // 35 runs today
  const old = [run(new Date(now - 20 * day)), run(new Date(now - 30 * day))];
  fs.mkdirSync(path.join(tmp, 'notes'));   // not a run folder: left alone
  appLog.prune(now);
  const left = fs.readdirSync(tmp);
  assert.ok(recent.every(n => left.includes(n)), 'runs of the last 14 days stay, even past 30');
  assert.ok(old.every(n => !left.includes(n)));
  assert.ok(left.includes('notes'));

  for (const name of recent.slice(1)) fs.rmSync(path.join(tmp, name), { recursive: true });
  const older = Array.from({ length: 31 }, (_, i) => run(new Date(now - (20 + i) * day)));
  appLog.prune(now);
  const after = fs.readdirSync(tmp);
  assert.strictEqual(older.filter(n => after.includes(n)).length, 29, 'with one recent run, 29 old ones fill the 30');
});
