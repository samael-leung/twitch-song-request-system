const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const WebSocket = require('ws');
const { stubModule } = require('./helpers');

// A pretend veadotube mini: its instance file in a temp folder, and its WebSocket server
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'veado-'));
process.env.VEADOTUBE_DIR = dir;
const settled = [];
stubModule('redemptions.js', { settle: (r, action) => settled.push({ ...r, action }) });
const veadotube = require('../server/veadotube');
const outfits = require('../server/outfits');

const STATES = ['iRO_1', 'iRO_2', 'iRO_3'];
let server, port, current = 'iRO_1';
const received = [];

function writeInstance(id, server, time = Math.floor(Date.now() / 1000)) {
  fs.writeFileSync(path.join(dir, id), JSON.stringify({ name: 'veadotube mini', id, version: '2.2', server, time }));
}

const until = async (fn, ms = 3000) => {
  const end = Date.now() + ms;
  while (!fn()) {
    if (Date.now() > end) throw new Error('timed out');
    await new Promise(r => setTimeout(r, 20));
  }
};

test.before(async () => {
  server = new WebSocket.Server({ port: 0 });
  await new Promise(r => server.on('listening', r));
  port = server.address().port;
  server.on('connection', (ws) => {
    ws.on('message', (m) => {
      const msg = JSON.parse(String(m).slice('nodes:'.length));
      const p = msg.payload;
      received.push(p);
      const reply = payload => ws.send('nodes:' + JSON.stringify({ event: 'payload', type: 'stateEvents', id: 'mini', name: 'avatar state', payload }));
      if (p.event === 'list') reply({ event: 'list', states: STATES.map(id => ({ id, name: id, thumbHash: 'h-' + id })) });
      if (p.event === 'peek') reply({ event: 'peek', state: current });
      if (p.event === 'set') current = p.state;
      if (p.event === 'thumb') reply({ event: 'thumb', state: p.state, hash: 'h-' + p.state, width: 128, height: 128, png: Buffer.from('png:' + p.state).toString('base64') });
    });
  });
  writeInstance('mini-live', `127.0.0.1:${port}`);
  fs.writeFileSync(path.join(dir, 'mini-closed'), ' '.repeat(140));                 // what a closed window leaves
  writeInstance('mini-old', '127.0.0.1:1', Math.floor(Date.now() / 1000) - 3600);   // an old file
  process.env.OUTFIT_REWARDS = 'reward-cloth';
  process.env.OUTFIT_DEFAULT = 'iRO_1';
  process.env.OUTFIT_MINUTES = '5';
  outfits.init({ send: () => {}, saveEnv: () => {} });
  await until(() => veadotube.list().length === 1 && veadotube.list()[0].current === 'iRO_1');
});

test.after(() => {
  veadotube.stop();
  server.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('finds only the running veadotube windows, with their states and the one shown', () => {
  assert.deepStrictEqual(veadotube.scan().map(w => w.id), ['mini-live']);
  const [w] = veadotube.list();
  assert.deepStrictEqual(w.states.map(s => s.id), STATES);
  assert.strictEqual(outfits.status().window, 'mini-live');   // the window with the default outfit
});

test('a redemption of an outfit reward waits for a pick; the pick wears it, marks it done and starts the time limit', async () => {
  const redeem = { id: 'r1', user_name: 'Mika', reward: { id: 'reward-cloth', title: 'Remove one cloth' } };
  assert.strictEqual(outfits.onRedemption(redeem), true);
  assert.strictEqual(outfits.onRedemption({ id: 'r0', reward: { id: 'song-reward' } }), false);
  assert.deepStrictEqual(outfits.status().pending.map(p => [p.id, p.user, p.reward]), [['r1', 'Mika', 'Remove one cloth']]);

  const before = Date.now();
  outfits.pick('iRO_3', 'r1');
  await until(() => current === 'iRO_3');
  const st = outfits.status();
  assert.deepStrictEqual(st.pending, []);
  assert.deepStrictEqual(settled, [{ id: 'r1', rewardId: 'reward-cloth', action: 'done' }]);
  assert.ok(st.revertAt >= before + 5 * 60000 && st.revertAt <= Date.now() + 5 * 60000);

  assert.throws(() => outfits.pick('iRO_2', 'r1'), { messageCode: 'redemptionHandled' });
  outfits.keep();
  assert.strictEqual(outfits.status().revertAt, 0);
});

test('outfits picked by hand stay; refunds and unknown outfits', async () => {
  outfits.onRedemption({ id: 'r2', user_name: 'Kuma', reward: { id: 'reward-cloth', title: 'Add one cloth' } });
  outfits.drop('r2', true);
  assert.deepStrictEqual(settled.at(-1), { id: 'r2', rewardId: 'reward-cloth', action: 'refund' });
  assert.deepStrictEqual(outfits.status().pending, []);

  outfits.pick('iRO_2');
  await until(() => current === 'iRO_2');
  assert.strictEqual(outfits.status().revertAt, 0);
  assert.throws(() => { process.env.OUTFIT_DEFAULT = ''; try { outfits.pick('nope'); } finally { process.env.OUTFIT_DEFAULT = 'iRO_1'; } }, { messageCode: 'outfitNotFound' });
});

test('thumbnails come from veadotube once, then from the cache', async () => {
  const png = await veadotube.thumb('mini-live', 'iRO_2');
  assert.strictEqual(String(png), 'png:iRO_2');
  const asked = received.filter(p => p.event === 'thumb').length;
  await veadotube.thumb('mini-live', 'iRO_2');
  assert.strictEqual(received.filter(p => p.event === 'thumb').length, asked);
  assert.strictEqual(await veadotube.thumb('mini-live', 'missing'), null);
});

test('settings: rewards, default and minutes are checked and saved', () => {
  const saved = [];
  outfits.init({ send: () => {}, saveEnv: v => saved.push(v) });
  const st = outfits.save({ rewards: ['a-1', 'b 2'], default: 'iRO_2', minutes: 0 });
  assert.deepStrictEqual(saved.at(-1), { OUTFIT_REWARDS: 'a-1', OUTFIT_DEFAULT: 'iRO_2', OUTFIT_MINUTES: '0' });
  assert.deepStrictEqual([st.rewards, st.default, st.minutes], [['a-1'], 'iRO_2', 0]);
  assert.throws(() => outfits.save({ minutes: -1 }), { messageCode: 'outfitBadSetting' });
  assert.throws(() => outfits.save({ rewards: 'x' }), { messageCode: 'outfitBadSetting' });
});

test('two windows with the same avatar: the outfit window is the one ☆ was pressed in', async () => {
  outfits._reset();
  process.env.OUTFIT_DEFAULT = 'iRO_1';
  writeInstance('mini-second', `127.0.0.1:${port}`);   // the same avatar in a second window
  await until(() => veadotube.list().length === 2, 6000);
  assert.deepStrictEqual([outfits.status().window, outfits.status().unsure], ['', true]);
  outfits.save({ default: 'iRO_1', window: 'mini-second' });
  assert.deepStrictEqual([outfits.status().window, outfits.status().unsure], ['mini-second', false]);
  assert.throws(() => outfits.pick('nope'), { messageCode: 'outfitNotFound' });
});
