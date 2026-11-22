// server/history.js: a write the network loses goes again, and a new song is known at once
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'history-'));
process.env.GOOGLE_CREDENTIALS_FILE = path.join(tmp, 'google-credentials.json');
fs.writeFileSync(process.env.GOOGLE_CREDENTIALS_FILE, '{}');
process.env.HISTORY_SHEET_ID = 'history-sheet';
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

// A history sheet that loses the first batchUpdate and the first append, as when the network is down
const calls = { batchUpdate: [], append: [] };
const down = new Error('getaddrinfo EAI_AGAIN sheets.googleapis.com');
const sheet = {
  spreadsheets: { values: {
    get: async () => ({ data: { values: [
      ['title', 'artist', 'total_requests', 'last_requested_at', 'last_requester'],
      ['我愛他', '孫燕姿', '3', '2026-11-01 12:00:00', 'a', 'a', '3', '', '0', '', '0'],
    ] } }),
    batchUpdate: async (req) => {
      calls.batchUpdate.push(req.requestBody.data);
      if (calls.batchUpdate.length === 1) throw down;
      return {};
    },
    append: async (req) => {
      calls.append.push(req.requestBody.values[0]);
      if (calls.append.length === 1) throw down;
      return { data: { updates: { updatedRange: 'History!A3:K3' } } };
    },
  } },
};
const googleapis = require.resolve('googleapis', { paths: [path.join(__dirname, '..', 'server')] });
require.cache[googleapis] = { id: googleapis, filename: googleapis, loaded: true, exports: {
  google: { auth: { GoogleAuth: class { async getClient() { return {}; } } }, sheets: () => sheet },
} };
const history = require('../server/history');

const settle = () => new Promise(r => setImmediate(r));

test('a write or a new row that fails goes again until the sheet takes it', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const errors = t.mock.method(console, 'error', () => {});
  t.mock.method(console, 'log', () => {});
  await history.init();

  // A song in the sheet: its write fails, then goes again 5 s later
  await history.recordRequest({ title: '我愛他', artist: '孫燕姿', requester: 'b' });
  t.mock.timers.tick(1500);
  await settle();
  assert.strictEqual(calls.batchUpdate.length, 1);
  assert.match(errors.mock.calls[0].arguments.join(' '), /trying again in 5s/);
  t.mock.timers.tick(5000);
  await settle();
  assert.strictEqual(calls.batchUpdate.length, 2);
  assert.strictEqual(calls.batchUpdate[1][0].range, 'A2:K2');
  assert.strictEqual(calls.batchUpdate[1][0].values[0][2], 4, 'the count went up once');

  // A new song: its row fails, but the cooldown knows it at once; requested again meanwhile,
  // the row that goes in has both
  await history.recordRequest({ title: '新歌', artist: '', requester: 'c' });
  assert.ok(history.getLastRequestedAt('新歌', ''), 'known before the sheet has it');
  await history.recordRequest({ title: '新歌', artist: '', requester: 'd' });
  t.mock.timers.tick(5000);
  await settle();
  assert.strictEqual(calls.append.length, 2, 'one row, added on the second try');
  assert.strictEqual(calls.append[1][2], 2);
  t.mock.timers.tick(1500);
  await settle();
  assert.strictEqual(calls.batchUpdate.length, 2, 'nothing more to write');
});
