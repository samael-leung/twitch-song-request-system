const test = require('node:test');
const assert = require('node:assert');
const { songKey, sameSong, findKey } = require('../shared/song-key');

const rows = {
  [songKey('天空', '蔡依林')]: { title: '天空', artist: '蔡依林', last_requested_at: '2026-11-01 12:00:00' },
  [songKey('Lemon', '')]: { title: 'Lemon', artist: '', last_requested_at: '2026-10-01 12:00:00' },
};

test('the same title by another artist is another song', () => {
  assert.strictEqual(findKey(rows, '天空', '蔡依林'), songKey('天空', '蔡依林'));
  assert.strictEqual(findKey(rows, ' 天空 ', '蔡依林 '), songKey('天空', '蔡依林'));
  assert.strictEqual(findKey(rows, '天空', '王菲'), null);
  assert.ok(!sameSong({ title: '天空', artist: '蔡依林' }, { title: '天空', artist: '王菲' }));
});

test('a song or a row without an artist matches any artist; the last requested wins', () => {
  assert.strictEqual(findKey(rows, 'Lemon', '米津玄師'), songKey('Lemon', ''));
  const two = { ...rows, [songKey('天空', '王菲')]: { title: '天空', artist: '王菲', last_requested_at: '2026-11-10 12:00:00' } };
  assert.strictEqual(findKey(two, '天空', ''), songKey('天空', '王菲'));
  assert.ok(sameSong({ title: '天空', artist: '' }, { title: '天空', artist: '王菲' }));
});
