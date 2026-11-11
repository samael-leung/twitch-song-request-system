const test = require('node:test');
const assert = require('node:assert');
const { stubModule } = require('./helpers');

stubModule('twitch.js', { ensureFreshToken: async () => {} });
const { toMap } = require('../server/chat-badges');

test('badge pictures by set and version; the channel\'s own replace Twitch\'s global ones', () => {
  const global = [
    { set_id: 'moderator', versions: [{ id: '1', image_url_1x: 'm1x', image_url_2x: 'm2x' }] },
    { set_id: 'subscriber', versions: [{ id: '0', image_url_2x: 'g-sub0' }] },
  ];
  const channel = [{ set_id: 'subscriber', versions: [{ id: '0', image_url_2x: 'c-sub0' }, { id: '12', image_url_2x: 'c-sub12' }] }];
  assert.deepStrictEqual(toMap(global, channel), { 'moderator/1': 'm2x', 'subscriber/0': 'c-sub0', 'subscriber/12': 'c-sub12' });
  assert.deepStrictEqual(toMap(undefined, undefined), {});
});
