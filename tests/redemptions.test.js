const { test } = require('node:test');
const assert = require('node:assert/strict');
const { handleRedemption } = require('../server/redemptions');
const queue = require('../server/queue');

test('shared redemption handler routes regular requests and ignores unrelated rewards', t => {
  const previous = process.env.TWITCH_REWARD_ID;
  process.env.TWITCH_REWARD_ID = 'song-reward';
  t.after(() => {
    if (previous === undefined) delete process.env.TWITCH_REWARD_ID;
    else process.env.TWITCH_REWARD_ID = previous;
  });
  const before = queue.getState().pending.length;
  handleRedemption({ reward: { id: 'other-reward' }, user_input: 'Not a song request', user_name: 'viewer' });
  assert.equal(queue.getState().pending.length, before);
  handleRedemption({ reward: { id: 'song-reward' }, user_input: 'Unknown song', user_name: 'viewer' });
  assert.equal(queue.getState().pending.length, before + 1);
  assert.equal(queue.getState().pending.at(-1).originalRequest, 'Unknown song');
  assert.equal(queue.getState().pending.at(-1).requester, 'viewer');
});
