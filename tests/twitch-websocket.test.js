const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createEventSubSocket } = require('../server/twitch-websocket');
const TYPE = 'channel.channel_points_custom_reward_redemption.add';
const flush = () => new Promise(resolve => setImmediate(resolve));

function fixture(t, api = { post: async () => {} }) {
  const sockets = [], events = [], states = [], posts = [];
  class Socket extends EventEmitter {
    constructor(url) { super(); this.url = url; sockets.push(this); }
    close() { if (!this.closed) { this.closed = true; this.emit('close'); } }
    terminate() { this.close(); }
    message(type, payload, id = 'id') {
      this.emit('message', JSON.stringify({ metadata: { message_type: type, message_id: id }, payload }));
    }
    welcome(id = 'session') { this.message('session_welcome', { session: { id, keepalive_timeout_seconds: 10 } }); }
  }
  const connection = createEventSubSocket({ token: 'test-token', clientId: 'client', broadcasterId: 'broadcaster',
    Socket, retryMs: 5, api: { post: async (...args) => { posts.push(args); return api.post(...args); } },
    onRedemption: event => events.push(event), onStatus: (...state) => states.push(state) });
  t.after(() => connection.stop());
  return { connection, sockets, events, states, posts };
}

test('subscribes with a user token/session; delivers each notification only once', async t => {
  const f = fixture(t);
  assert.equal(f.sockets[0].url, 'wss://eventsub.wss.twitch.tv/ws');
  f.sockets[0].welcome(); await flush();
  assert.equal(f.posts.length, 1);
  assert.deepEqual(f.posts[0][1].transport, { method: 'websocket', session_id: 'session' });
  assert.equal(f.posts[0][1].condition.broadcaster_user_id, 'broadcaster');
  assert.equal(f.posts[0][2].headers.Authorization, 'Bearer test-token');
  assert.equal(f.states.at(-1)[0], 'connected');
  const payload = { subscription: { type: TYPE }, event: { id: 'redemption' } };
  f.sockets[0].message('notification', payload); f.sockets[0].message('notification', payload);
  f.sockets[0].message('session_keepalive', {});
  assert.deepEqual(f.events, [{ id: 'redemption' }]);
});

test('reconnect handoff keeps old socket until welcome and does not resubscribe', async t => {
  const f = fixture(t);
  f.sockets[0].welcome(); await flush();
  f.sockets[0].message('session_reconnect', { session: { reconnect_url: 'wss://eventsub.wss.twitch.tv/ws?session=transfer' } });
  assert.equal(f.sockets.length, 2); assert.equal(f.sockets[0].closed, undefined);
  f.sockets[1].welcome('new-session'); await flush();
  assert.equal(f.sockets[0].closed, true); assert.equal(f.posts.length, 1);
});

test('unexpected disconnect reconnects and subscribes to the fresh session', async t => {
  const f = fixture(t);
  f.sockets[0].welcome(); await flush(); f.sockets[0].terminate();
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(f.sockets.length, 2);
  f.sockets[1].welcome('fresh'); await flush();
  assert.equal(f.posts.length, 2);
  assert.equal(f.posts[1][1].transport.session_id, 'fresh');
});

test('keepalive watchdog replaces a silent socket', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(t);
  f.sockets[0].welcome(); await flush();
  t.mock.timers.tick(11001);
  assert.equal(f.sockets[0].closed, true);
  t.mock.timers.tick(5);
  assert.equal(f.sockets.length, 2);
});

test('revocation, unauthorized subscriptions and untrusted reconnect URLs stop the connection', async t => {
  for (const scenario of ['revoked', 'unauthorized', 'bad-url']) {
    const f = fixture(t, { post: async () => {
      if (scenario === 'unauthorized') throw { response: { status: 401 } };
    } });
    f.sockets[0].welcome(); await flush();
    if (scenario === 'revoked') f.sockets[0].message('revocation', {});
    if (scenario === 'bad-url') f.sockets[0].message('session_reconnect', { session: { reconnect_url: 'wss://other.example/ws' } });
    assert.equal(f.states.at(-1)[0], 'authorization_required');
    assert.equal(f.sockets[0].closed, true);
  }
});
