// server/twitch.js: a connection that goes quiet is dropped and made again, a session that couldn't
// subscribe everything starts over, and what a drop missed is fetched once
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { EventEmitter } = require('events');

Object.assign(process.env, {
  TWITCH_CLIENT_ID: 'client', TWITCH_USER_ACCESS_TOKEN: 'token', TWITCH_BROADCASTER_ID: '1',
  TWITCH_USER_TOKEN_EXPIRES_AT: String(Date.now() + 24 * 3600000),
});

// Twitch's side, faked: every WebSocket the server opens, and its subscription requests
const sockets = [];
class FakeSocket extends EventEmitter {
  constructor(url) { super(); this.url = url; this.ended = null; sockets.push(this); }
  terminate() { this.ended = 'terminate'; this.emit('close', 1006, Buffer.alloc(0)); }
  close() { this.ended = 'close'; this.emit('close', 1000, Buffer.alloc(0)); }
  send() {}
  say(type, payload = {}, metadata = {}) {
    this.emit('message', JSON.stringify({ metadata: { message_type: type, ...metadata }, payload }));
  }
}
let failOn = null;   // a subscription that fails once, as if Twitch can't be reached
const posts = [];
const fake = (name, exports) => {
  const file = require.resolve(name, { paths: [path.join(__dirname, '..', 'server')] });
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
};
fake('ws', FakeSocket);
fake('axios', {
  post: async (url, body) => {
    posts.push(body.type);
    if (body.type === failOn) { failOn = null; throw Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }); }
    return { data: {} };
  },
});
const twitch = require('../server/twitch');

const settle = async () => { for (let i = 0; i < 20; i++) await new Promise(r => setImmediate(r)); };
const welcome = sock => sock.say('session_welcome', { session: { id: `s${sockets.indexOf(sock)}`, keepalive_timeout_seconds: 10 } });

test('quiet, half-subscribed and dropped connections come back, and the redemptions a drop missed come once', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000_000 });
  for (const level of ['log', 'warn', 'error']) t.mock.method(console, level, () => {});
  const handled = [];
  const backs = [];
  twitch.setEventHandler(e => handled.push(e.id));
  twitch.setReconnectHandler(info => backs.push(info));

  await twitch.connect();
  welcome(sockets[0]);
  await settle();
  assert.ok(posts.includes('channel.chat.message'));
  assert.strictEqual(backs.length, 0, 'the first connection is not a reconnect');

  // Keepalives keep it; a redemption comes in
  t.mock.timers.tick(9000);
  sockets[0].say('session_keepalive');
  sockets[0].say('notification', { event: { id: 'r1' } }, { message_id: 'm1', subscription_type: 'channel.channel_points_custom_reward_redemption.add' });
  const lastHeard = Date.now();
  t.mock.timers.tick(14000);
  assert.strictEqual(sockets[0].ended, null, 'heard from within keepalive + 5 s');

  // Then nothing (the network is gone, Windows hasn't closed the socket): dropped after 15 s
  t.mock.timers.tick(1000);
  assert.strictEqual(sockets[0].ended, 'terminate');
  t.mock.timers.tick(5000);
  assert.strictEqual(sockets.length, 2, 'reconnecting');

  // The network is still coming back: chat can't be subscribed, so the session starts over
  posts.length = 0;
  failOn = 'channel.chat.message';   // as on 11-17: redemptions subscribed, then ECONNRESET
  welcome(sockets[1]);
  await settle();
  assert.deepStrictEqual(posts, ['channel.channel_points_custom_reward_redemption.add', 'channel.chat.message']);
  assert.strictEqual(sockets[1].ended, 'terminate');
  assert.strictEqual(backs.length, 0, 'not back yet');
  t.mock.timers.tick(5000);

  // Back: the gap counts from when the last good session heard from Twitch
  welcome(sockets[2]);
  await settle();
  assert.deepStrictEqual(backs, [{ since: lastHeard }]);

  // A redemption fetched for the gap goes on once, also if EventSub sends it after all
  assert.strictEqual(twitch.replayRedemption({ id: 'r1' }), false, 'came in before the drop');
  assert.strictEqual(twitch.replayRedemption({ id: 'r2' }), true);
  sockets[2].say('notification', { event: { id: 'r2' } }, { message_id: 'm2', subscription_type: 'channel.channel_points_custom_reward_redemption.add' });
  assert.deepStrictEqual(handled, ['r1', 'r2']);

  // Twitch moving the session (session_reconnect) isn't a drop: nothing to fetch
  sockets[2].say('session_reconnect', { session: { reconnect_url: 'wss://moved' } });
  welcome(sockets[3]);
  await settle();
  assert.strictEqual(sockets[3].url, 'wss://moved');
  assert.strictEqual(backs.length, 1);
});
