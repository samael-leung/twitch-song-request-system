const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alerts-'));
process.env.ALERTS_FILE = path.join(dir, 'alerts.json');
process.env.ALERT_MEDIA_DIR = path.join(dir, 'media');
fs.mkdirSync(process.env.ALERT_MEDIA_DIR);
for (const f of ['raid.gif', 'horn.mp3', 'notes.txt']) fs.writeFileSync(path.join(process.env.ALERT_MEDIA_DIR, f), '');
const alerts = require('../server/alerts');

const sent = [];
alerts.init(m => sent.push(m));
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
test.beforeEach(() => { sent.length = 0; alerts._reset(); });

const user = (name, id = name) => ({ id, login: name.toLowerCase(), name });
const notice = (type, extra = {}) => ({ kind: 'notice', id: 'n-' + type, at: 1, notice: type, user: user('Mika'), text: '', ...extra });

test('which records are alerts: follows once, subs, gifts, cheers, raids', () => {
  assert.deepStrictEqual(alerts.alertFor({ kind: 'follow', user: user('Kuma') }), { kind: 'follow' });
  assert.strictEqual(alerts.alertFor({ kind: 'follow', user: user('Kuma') }), null);   // unfollow + follow again
  assert.deepStrictEqual(alerts.alertFor(notice('resub', { months: 12, tier: '1000' })), { kind: 'sub', notice: 'resub', months: 12, tier: '1000' });
  assert.deepStrictEqual(alerts.alertFor(notice('sub_gift', { tier: '1000', recipient: user('Tora') })), { kind: 'gift', count: 1, tier: '1000', recipient: 'Tora' });
  assert.strictEqual(alerts.alertFor(notice('sub_gift', { communityGift: 'g1', recipient: user('Tora') })), null);   // part of a gift of several
  assert.deepStrictEqual(alerts.alertFor(notice('community_sub_gift', { count: 20, tier: '1000' })), { kind: 'gift', count: 20, tier: '1000' });
  assert.deepStrictEqual(alerts.alertFor(notice('raid', { viewers: 42 })), { kind: 'raid', viewers: 42, avatar: '' });
  assert.deepStrictEqual(alerts.alertFor({ kind: 'chat', user: user('Usagi'), bits: 100, parts: [] }), { kind: 'cheer', bits: 100 });
  assert.strictEqual(alerts.alertFor({ kind: 'chat', user: user('Usagi'), parts: [] }), null);
  assert.strictEqual(alerts.alertFor(notice('announcement')), null);
});

test('minimums, the big version and its own picture; the message without the cheermotes', () => {
  alerts.update({ kinds: { raid: { min: 5, bigAt: 50, bigSeconds: 12, image: '', bigImage: 'raid.gif', sound: 'horn.mp3' } } });
  assert.strictEqual(alerts.fromRecord(notice('raid', { viewers: 3 })), null);
  const small = alerts.fromRecord(notice('raid', { viewers: 10 }));
  assert.deepStrictEqual([small.big, small.seconds, small.image, small.sound], [false, 8, '', 'horn.mp3']);
  const big = alerts.fromRecord(notice('raid', { viewers: 60 }));
  assert.deepStrictEqual([big.big, big.seconds, big.image, big.sound], [true, 12, 'raid.gif', 'horn.mp3']);
  assert.deepStrictEqual(sent.map(m => m.type), ['alert', 'alert']);

  const cheer = alerts.fromRecord({ kind: 'chat', user: user('Usagi'), bits: 100, text: 'Cheer100 加油', parts: [{ t: 'cheer', text: 'Cheer100', bits: 100 }, { t: 'text', text: ' 加油' }] });
  assert.deepStrictEqual([cheer.kind, cheer.bits, cheer.text, cheer.name], ['cheer', 100, '加油', 'Usagi']);

  alerts.update({ kinds: { follow: { on: false } } });
  assert.strictEqual(alerts.fromRecord({ kind: 'follow', user: user('Kuma') }), null);
});

test('redemptions are not alerts (reward effects play them); tests, replays and skips go to the overlays', () => {
  assert.strictEqual(alerts.fromRecord({ kind: 'redeem', user: user('Mika'), rewardId: 'r1', reward: 'Hydrate', text: '' }), null);
  assert.throws(() => alerts.update({ kinds: { redeem: { on: true } } }), { messageCode: 'alertBadSetting' });

  const t = alerts.test('gift', true);
  assert.deepStrictEqual([t.test, t.big, t.count], [true, true, 10]);
  assert.ok(alerts.replay(t.id));
  assert.strictEqual(sent.at(-1).alert.replay, true);
  assert.notStrictEqual(sent.at(-1).alert.id, t.id);
  alerts.skip();
  assert.deepStrictEqual(sent.at(-1), { type: 'alert-skip' });
  assert.deepStrictEqual(alerts.status().recent.map(a => a.kind), ['gift']);
});

test('settings are checked, saved and read back', () => {
  assert.throws(() => alerts.update({ kinds: { raid: { seconds: 999 } } }), { messageCode: 'alertBadSetting' });
  assert.throws(() => alerts.update({ kinds: { raid: { image: 'missing.png' } } }), { messageCode: 'alertBadSetting' });
  assert.throws(() => alerts.update({ kinds: { nope: { on: true } } }), { messageCode: 'alertBadSetting' });
  assert.throws(() => alerts.update({ kinds: { raid: { colour: 'red' } } }), { messageCode: 'alertBadSetting' });
  assert.strictEqual(alerts.status().kinds.follow.sound, '@default');   // the default sound…
  assert.strictEqual(alerts.status().defaultSound, '@chime');           // …which is the built-in chime
  assert.throws(() => alerts.update({ defaultSound: 'missing.mp3' }), { messageCode: 'alertBadSetting' });
  assert.throws(() => alerts.update({ kinds: { raid: { image: '@default' } } }), { messageCode: 'alertBadSetting' });
  alerts.update({ kinds: { follow: { sound: '' }, raid: { bigSound: '@chime' } } });
  assert.deepStrictEqual([alerts.status().kinds.follow.sound, alerts.status().kinds.raid.bigSound], ['', '@chime']);
  alerts.update({ kinds: { cheer: { min: 100, volume: 40 } } });
  alerts._reset();   // from alerts.json again
  assert.deepStrictEqual([alerts.status().kinds.cheer.min, alerts.status().kinds.cheer.volume], [100, 40]);
  assert.deepStrictEqual(alerts.files(), ['horn.mp3', 'raid.gif']);
});

test('the default sound: every kind on it follows, a kind can pick its own, an old alerts.json keeps the chime', () => {
  alerts.update({ defaultSound: 'horn.mp3', kinds: { raid: { bigAt: 50, bigSound: '' }, cheer: { sound: '' } } });
  assert.strictEqual(alerts.fromRecord(notice('resub', { months: 2, tier: '1000' })).sound, 'horn.mp3');
  assert.strictEqual(alerts.fromRecord(notice('raid', { viewers: 60 })).sound, 'horn.mp3');   // big: same sound = the default
  assert.strictEqual(alerts.fromRecord({ kind: 'chat', user: user('Usagi'), bits: 100, parts: [] }).sound, '');   // its own: none

  fs.writeFileSync(process.env.ALERTS_FILE, JSON.stringify({ kinds: { follow: { sound: '@chime' }, sub: { sound: 'horn.mp3' } } }));
  alerts._reset();
  const st = alerts.status();
  assert.deepStrictEqual([st.defaultSound, st.kinds.follow.sound, st.kinds.sub.sound], ['@chime', '@default', 'horn.mp3']);
});
