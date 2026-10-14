const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const flush = () => new Promise(resolve => setImmediate(resolve));

function loadTwitch(post = async () => ({ data: {} })) {
  const sockets = [], calls = [], timers = [];
  const env = { TWITCH_CLIENT_ID: 'test-client', TWITCH_BROADCASTER_ID: 'test-broadcaster',
    TWITCH_USER_ACCESS_TOKEN: 'test-access', TWITCH_USER_REFRESH_TOKEN: 'test-refresh',
    TWITCH_USER_TOKEN_EXPIRES_AT: String(Date.now() + 3600000) };
  let saved = '';
  class Socket extends EventEmitter {
    constructor(url) { super(); this.url = url; sockets.push(this); }
    close() { this.emit('close', 1000, 'test'); }
    message(type, payload, metadata = {}) {
      this.emit('message', JSON.stringify({ metadata: { message_type: type, ...metadata }, payload }));
    }
  }
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../server/twitch.js'), 'utf8'), {
    module, __dirname: path.join(__dirname, '../server'), process: { env }, Date, URL, Buffer,
    console: { log() {}, warn() {}, error() {} },
    setTimeout: (fn, delay) => { timers.push({ fn, delay }); },
    require: name => ({ axios: { post: async (...args) => { calls.push(args); return post(...args); } },
      ws: Socket, fs: { readFileSync: () => saved, writeFileSync: (name, value) => { saved = value; } }, path })[name],
  });
  return { twitch: module.exports, env, sockets, calls, timers };
}

test('upstream refresh token concurrency performs one rotation and persists the result', async () => {
  let finish;
  const f = loadTwitch(() => new Promise(resolve => { finish = resolve; }));
  f.env.TWITCH_USER_TOKEN_EXPIRES_AT = '0';
  const first = f.twitch.ensureFreshToken(), second = f.twitch.ensureFreshToken();
  assert.equal(f.calls.length, 1);
  finish({ data: { access_token: 'rotated-access', refresh_token: 'rotated-refresh', expires_in: 3600 } });
  await Promise.all([first, second]);
  assert.equal(f.env.TWITCH_USER_ACCESS_TOKEN, 'rotated-access');
  assert.equal(f.env.TWITCH_USER_REFRESH_TOKEN, 'rotated-refresh');
  await f.twitch.ensureFreshToken(); assert.equal(f.calls.length, 1);
});

test('upstream connects once, subscribes to redemptions and chat, and deduplicates events', async () => {
  const f = loadTwitch();
  const songs = [], chat = [];
  f.twitch.setEventHandler(event => songs.push(event));
  f.twitch.setChatHandler(event => chat.push(event));
  await f.twitch.connect(); await f.twitch.connect();
  assert.equal(f.sockets.length, 1);
  f.sockets[0].message('session_welcome', { session: { id: 'session' } }); await flush();
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[0][1].transport.method, 'websocket');
  assert.equal(f.calls[0][1].transport.session_id, 'session');
  assert.equal(f.calls[1][1].type, 'channel.chat.message');
  const metadata = { message_id: 'song', subscription_type: 'channel.channel_points_custom_reward_redemption.add' };
  f.sockets[0].message('notification', { event: { id: 'request' } }, metadata);
  f.sockets[0].message('notification', { event: { id: 'request' } }, metadata);
  f.sockets[0].message('notification', { event: { message: '!so test' } },
    { message_id: 'chat', subscription_type: 'channel.chat.message' });
  assert.equal(songs.length, 1); assert.equal(chat.length, 1);
  assert.equal(songs[0].id, 'request');
});

test('upstream can reconnect after a rejected refresh followed by new authorization', async () => {
  const f = loadTwitch(async () => { throw { response: { status: 400, data: { message: 'invalid refresh token' } } }; });
  f.env.TWITCH_USER_TOKEN_EXPIRES_AT = '0';
  await f.twitch.connect();
  assert.equal(f.sockets.length, 0);
  assert.equal(f.env.TWITCH_USER_ACCESS_TOKEN, '');
  f.env.TWITCH_USER_ACCESS_TOKEN = 'new-authorization';
  f.env.TWITCH_USER_TOKEN_EXPIRES_AT = String(Date.now() + 3600000);
  await f.twitch.connect();
  assert.equal(f.sockets.length, 1);
});
