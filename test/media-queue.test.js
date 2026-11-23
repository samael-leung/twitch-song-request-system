const test = require('node:test');
const assert = require('node:assert');

test.mock.timers.enable({ apis: ['setTimeout'] });
console.log = () => {};
console.warn = () => {};

const mediaQueue = require('../server/media-queue');
const sent = [];
mediaQueue.init(msg => sent.push(msg));
const last = () => sent[sent.length - 1];

test('a duplicate end signal from a second clip player does not skip ahead', () => {
  mediaQueue.enqueue({ title: 'A', kind: 'video', duration: 10 });
  mediaQueue.enqueue({ title: 'B', kind: 'video', duration: 10 });
  mediaQueue.enqueue({ title: 'C', kind: 'video', duration: 10 });
  const idA = last().mediaId;
  mediaQueue.onEnded(idA);
  mediaQueue.onEnded(idA);
  assert.strictEqual(last().title, 'B');
});

test('the watchdog moves on when no clip player reports the end', () => {
  test.mock.timers.tick(10_000 + 3_000 + 15_000 - 1);
  assert.strictEqual(last().title, 'B');
  test.mock.timers.tick(1);
  assert.strictEqual(last().title, 'C');
});

test('!stop clears the queue and cancels the watchdog', () => {
  mediaQueue.enqueue({ title: 'D', kind: 'video', duration: 10 });
  mediaQueue.stopAll();
  const count = sent.length;
  test.mock.timers.tick(10 * 60_000);
  assert.strictEqual(sent.length, count);
  assert.strictEqual(last().type, 'media-stop');
});

test('a mode holding clips: the one on screen finishes, new ones wait, letting go plays them', () => {
  mediaQueue.enqueue({ title: 'E', kind: 'video', duration: 10 });
  mediaQueue.setHold(true);
  assert.strictEqual(mediaQueue.isHeld(), true);
  for (const title of ['F', 'G', 'H', 'I']) mediaQueue.enqueue({ title, kind: 'video', duration: 10 });   // more than 3 while held
  mediaQueue.onEnded(last().mediaId);
  assert.strictEqual(last().title, 'E');
  const count = sent.length;
  test.mock.timers.tick(10 * 60_000);
  assert.strictEqual(sent.length, count);
  mediaQueue.setHold(false);
  assert.strictEqual(last().title, 'F');
  for (const title of ['G', 'H', 'I']) {
    mediaQueue.onEnded(last().mediaId);
    assert.strictEqual(last().title, title);
  }
  mediaQueue.stopAll();
});

test('what waits while held is listed; ▶ plays one at once, ✕ and !stop hand back what a roll took', () => {
  const lists = [];
  mediaQueue.setWaitingListener(w => lists.push(w));
  const dropped = [];
  mediaQueue.setHold(true);
  mediaQueue.enqueue({ title: 'Roll', kind: 'sponsor-card', broadcasters: [] }, { onDrop: () => dropped.push('Roll') });
  mediaQueue.enqueue({ title: 'Clip', kind: 'video', labelKey: 'shoutout', duration: 10 });
  mediaQueue.enqueue({ title: 'Ending', kind: 'sponsor-card', groups: [] }, { onDrop: () => dropped.push('Ending') });
  const waiting = mediaQueue.waiting();
  assert.deepStrictEqual(waiting.map(w => [w.title, w.from]), [['Roll', '!tk'], ['Clip', '!so'], ['Ending', '!endingtk']]);
  assert.deepStrictEqual(lists[lists.length - 1], waiting, 'the dashboards hear of each change');

  assert.strictEqual(mediaQueue.playQueued(waiting[1].id), true);
  assert.strictEqual(last().title, 'Clip', 'plays although held');
  assert.strictEqual(mediaQueue.dropQueued(waiting[0].id), true);
  assert.deepStrictEqual(dropped, ['Roll']);
  assert.strictEqual(mediaQueue.dropQueued(waiting[0].id), false, 'already gone');
  mediaQueue.stopAll();
  assert.deepStrictEqual(dropped, ['Roll', 'Ending']);
  mediaQueue.setHold(false);
  assert.deepStrictEqual(mediaQueue.waiting(), [], 'nothing is listed when not held');
});
