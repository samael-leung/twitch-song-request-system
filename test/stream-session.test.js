const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { stubModule } = require('./helpers');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stream-session-'));
process.env.STREAM_SESSION_FILE = path.join(tmp, 'stream-session.json');
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
stubModule('twitch.js', { ensureFreshToken: async () => {} });
const session = require('../server/stream-session');

test('a session runs from go-live to the next go-live; ending the stream keeps it', () => {
  const changes = [];
  session.init(s => changes.push(s));
  session.onEvent('stream.online', { started_at: '2026-10-26T12:00:00Z' });
  session.onEvent('stream.offline', {});
  assert.deepStrictEqual(session.get(), { startedAt: Date.parse('2026-10-26T12:00:00Z'), live: false });
  session.onEvent('stream.online', { started_at: '2026-10-27T12:00:00Z' });
  assert.deepStrictEqual(changes.map(c => c.live), [true, false, true]);
  assert.strictEqual(JSON.parse(fs.readFileSync(process.env.STREAM_SESSION_FILE, 'utf8')).startedAt, Date.parse('2026-10-27T12:00:00Z'), 'kept for a restart');
});

test('a stream that drops and is back within 15 minutes is the same session; after a longer break, a new one', (t) => {
  t.mock.method(console, 'log', () => {});
  const at = ms => new Date(ms).toISOString();
  const start = Date.now() - 3600000;
  session.onEvent('stream.online', { started_at: at(start) });
  session.onEvent('stream.offline', {});
  session.onEvent('stream.online', { started_at: at(Date.now() + 60000) });   // Twitch's new broadcast
  assert.deepStrictEqual(session.get(), { startedAt: start, live: true }, 'who came before the drop is still to announce');
  session.onEvent('stream.online', { started_at: at(Date.now() + 120000) });   // the offline event missed
  assert.strictEqual(session.get().startedAt, start);
  session.onEvent('stream.offline', {});
  const later = Date.now() + 20 * 60000;
  session.onEvent('stream.online', { started_at: at(later) });
  assert.strictEqual(session.get().startedAt, later);
});
