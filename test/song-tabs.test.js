const test = require('node:test');
const assert = require('node:assert');
const songTabs = require('../server/song-tabs');

test('the random pick mode is weighted unless .env says pure', () => {
  assert.strictEqual(songTabs.pickMode({}), 'weighted');
  assert.strictEqual(songTabs.pickMode({ RANDOM_PICK_MODE: 'Pure' }), 'pure');
  assert.strictEqual(songTabs.pickMode({ RANDOM_PICK_MODE: 'odd' }), 'weighted');
  assert.strictEqual(songTabs.parsePickMode('pure'), 'pure');
  assert.throws(() => songTabs.parsePickMode('odd'), { messageCode: 'pickModeBad' });
});

test('saving left-out tabs keeps the first one first: Pending adds songs to it', () => {
  const current = ['待練勿點', '草稿'];
  assert.deepStrictEqual(songTabs.excludedList(['English', '草稿', '待練勿點'], current), ['待練勿點', '草稿', 'English']);
  assert.deepStrictEqual(songTabs.excludedList(['草稿'], current), ['草稿']);
  assert.deepStrictEqual(songTabs.excludedList([], current), []);
  assert.deepStrictEqual(songTabs.excludedList([' 日語 ', '日語', ''], []), ['日語']);
});

test('a tab name with a comma cannot be left out, since EXCLUDED_TABS is comma-separated', () => {
  assert.throws(() => songTabs.excludedList(['A, B'], []), { messageCode: 'tabNameComma' });
  assert.throws(() => songTabs.excludedList(['A，B'], []), { messageCode: 'tabNameComma' });
  assert.throws(() => songTabs.excludedList('待練勿點', []), { messageCode: 'tabsBad' });
});
