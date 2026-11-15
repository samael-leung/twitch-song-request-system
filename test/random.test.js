const test = require('node:test');
const assert = require('node:assert');
const { stubModule, song } = require('./helpers');

const songs = [
  ...Array.from({ length: 5 }, (_, i) => song(`國-${i}`, 'a', '國語')),
  ...Array.from({ length: 5 }, (_, i) => song(`日-${i}`, 'a', '日語')),
];
const lastRequested = {};
stubModule('sheets.js', { getSongs: () => songs });
stubModule('history.js', {
  getHistory: () => ({}),
  getLastRequestedAt: (title, artist) => lastRequested[`${title}|${artist}`] || lastRequested[title] || null,
});
console.log = () => {};
const { pickRandom } = require('../server/random');

const sqlTime = date => date.toISOString().replace('T', ' ').slice(0, 19);
const drawMany = (exclude, tabs) => Array.from({ length: 200 }, () => pickRandom(exclude, tabs));

test('a tab-restricted reward only draws from its tabs', () => {
  for (const mode of ['weighted', 'pure']) {
    process.env.RANDOM_PICK_MODE = mode;
    assert.ok(drawMany([], ['日語']).every(s => s.tab === '日語'), mode);
  }
});

test('songs already in the queue are never drawn', () => {
  const exclude = ['日-0', '日-1', '日-2', '日-3'].map(t => song(t, 'a'));
  assert.ok(drawMany(exclude, ['日語']).every(s => s.title === '日-4'));
  assert.strictEqual(pickRandom([...exclude, song('日-4', 'a')], ['日語']), null);
});

test('the cooldown skips recently requested songs', () => {
  process.env.RANDOM_COOLDOWN_DAYS = '7';
  for (let i = 0; i < 4; i++) lastRequested[`日-${i}`] = sqlTime(new Date());
  assert.ok(drawMany([], ['日語']).every(s => s.title === '日-4'));

  process.env.RANDOM_COOLDOWN_DAYS = '0';
  const titles = new Set(drawMany([], ['日語']).map(s => s.title));
  assert.ok(titles.size > 1);
});

test('a song in the queue keeps out only itself, not another artist\'s song of the same title', () => {
  songs.push(song('天空', '蔡依林', '雙'), song('天空', '王菲', '雙'));
  try {
    process.env.RANDOM_COOLDOWN_DAYS = '0';
    assert.ok(drawMany([song('天空', '蔡依林')], ['雙']).every(s => s.artist === '王菲'));
    process.env.RANDOM_COOLDOWN_DAYS = '7';
    lastRequested['天空|王菲'] = sqlTime(new Date());
    assert.ok(drawMany([], ['雙']).every(s => s.artist === '蔡依林'));
  } finally {
    songs.splice(-2);
  }
});
