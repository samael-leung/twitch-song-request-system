const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { stubModule } = require('./helpers');

const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'clip-hold-'));
process.env.STREAM_MODES_FILE = path.join(folder, 'modes.json');
const effects = [];
stubModule('stream-app.js', { APPS: {}, settings: () => ({ app: '' }), status: () => ({ app: '', connected: false }),
  get: async () => { effects.push('stream-app'); throw Error('Must not reapply scenes'); } });
stubModule('chat-send.js', { send: async () => { effects.push('chat'); } });
stubModule('twitch.js', { ensureFreshToken: async () => {} });
stubModule('twitch-clips.js', { getClipSignedUrl: async () => 'http://localhost/fixture.m3u8' });
stubModule('chat-mod.js', { twitchShoutout: async () => { throw Error('Twitch Shoutouts only work while live'); } });
stubModule('shoutout-history.js', { addShoutout() {} });
stubModule('queue.js', { broadcastRaw() {} });
const axios = require('axios');
test.mock.method(axios, 'get', async url => ({ data: { data: url.endsWith('/users')
  ? [{ id: 'fixture-user', login: 'fixture', display_name: 'Fixture' }]
  : [{ id: 'fixture-clip', title: 'Clip found despite Twitch announcement refusal', broadcaster_name: 'Fixture', duration: 10 }] } }));
test.mock.timers.enable({ apis: ['setTimeout'] });
const queue = require('../server/media-queue');
const modes = require('../server/modes');
const rewardEffects = require('../server/reward-effects');
const shoutout = require('../server/commands/shoutout').shoutout;
const sent = [], changes = [];
queue.init(message => sent.push(message));

test.beforeEach(() => {
  queue.stopAll(); queue.setHold(false);
  fs.writeFileSync(process.env.STREAM_MODES_FILE, JSON.stringify({ modes: [], active: null }));
  modes.init(message => changes.push(message));
  sent.length = changes.length = effects.length = 0;
});
test.after(() => { queue.stopAll(); queue.setHold(false); fs.rmSync(folder, { recursive: true, force: true }); });

test('unchecking hold on the active mode plays queued !so clips even if Twitch refuses its announcement', async () => {
  const mode = await modes.create({ name: 'Singing', icon: '🎤' });
  modes.update({ ...mode, holdClips: true });
  await modes.apply(mode.id);
  const result = await shoutout('fixture');
  assert.equal(result.clip, true); assert.ok(result.twitch);
  assert.equal(queue.isHeld(), true); assert.equal(sent.length, 0);
  modes.update({ ...mode, holdClips: false, chat: 'Do not post this while editing' });
  assert.equal(queue.isHeld(), false);
  assert.equal(sent.length, 1); assert.equal(sent[0].type, 'media');
  assert.equal(sent[0].src, 'http://localhost/fixture.m3u8');
  assert.equal(changes.at(-1).held, false);
  assert.deepEqual(effects, []);
  assert.equal(JSON.parse(fs.readFileSync(process.env.STREAM_MODES_FILE)).modes[0].holdClips, false);
});

test('editing an inactive mode cannot release the active mode hold', async () => {
  const active = await modes.create({ name: 'Singing', icon: '🎤' });
  const inactive = await modes.create({ name: 'Talking', icon: '💬' });
  modes.update({ ...active, holdClips: true }); await modes.apply(active.id);
  queue.enqueue({ type: 'media', kind: 'video', title: 'Waiting', duration: 10 });
  modes.update({ ...inactive, holdClips: false });
  assert.equal(queue.isHeld(), true); assert.equal(sent.length, 0);
});

test('enabling hold on the active mode lets the current clip finish and keeps later clips queued', async () => {
  const mode = await modes.create({ name: 'Talking', icon: '💬' }); await modes.apply(mode.id);
  queue.enqueue({ type: 'media', kind: 'video', title: 'First', duration: 10 });
  modes.update({ ...mode, holdClips: true });
  queue.enqueue({ type: 'media', kind: 'video', title: 'Second', duration: 10 });
  assert.equal(sent.length, 1);
  queue.onEnded(sent[0].mediaId); assert.equal(sent.length, 1);
  modes.update({ ...mode, holdClips: false });
  assert.equal(sent.at(-1).title, 'Second');
});

test('restart restores the saved hold and editing it off releases clips without changing the active mode', async () => {
  const mode = await modes.create({ name: 'Singing', icon: '🎤' });
  modes.update({ ...mode, holdClips: true }); await modes.apply(mode.id);
  modes.init(message => changes.push(message));
  assert.equal(queue.isHeld(), true);
  queue.enqueue({ type: 'media', kind: 'video', title: 'After restart', duration: 10 });
  modes.update({ ...(await modes.view({ live: false })).modes[0], holdClips: false });
  assert.equal(sent.at(-1).title, 'After restart');
  assert.equal((await modes.view({ live: false })).active, mode.id);
});

test('editing the active mode immediately updates reward-effect pause without reapplying scenes or chat', async () => {
  const mode = await modes.create({ name: 'Singing', icon: '🎤' });
  modes.update({ ...mode, pauseEffects: true }); await modes.apply(mode.id);
  assert.equal(rewardEffects.status().modePaused, true);
  effects.length = 0;
  modes.update({ ...mode, pauseEffects: false, chat: 'Do not send while editing' });
  assert.equal(rewardEffects.status().modePaused, false);
  assert.deepEqual(effects, []);
  modes.update({ ...mode, pauseEffects: true });
  modes.init(message => changes.push(message));
  assert.equal(rewardEffects.status().modePaused, true);
});

test('legacy SO repair still works independently of the new reward-effects module', () => {
  const legacy = fs.readFileSync(path.join(__dirname, '../repair/shoutout-hold/modes.js'));
  assert.ok(!legacy.includes(Buffer.from("require('./reward-effects')")));
  const project = path.join(folder, 'legacy'); fs.mkdirSync(path.join(project, 'server'), { recursive: true });
  const target = path.join(project, 'server/modes.js'); fs.writeFileSync(target, legacy);
  const { install } = require('../repair/shoutout-hold/install');
  assert.equal(install(project).unchanged, true);
  const customized = Buffer.concat([legacy, Buffer.from('\n// local customization\n')]); fs.writeFileSync(target, customized);
  assert.throws(() => install(project), /Unrecognized/);
  assert.deepEqual(fs.readFileSync(target), customized);
});
