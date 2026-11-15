const test = require('node:test');
const assert = require('node:assert');

// Twitch, the chat log and the clip player stand-ins: what was asked of them, in order
const calls = [];
let groups = [];
function fake(rel, exports) {
  const id = require.resolve(rel);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
fake('../server/chat-mod', {
  lookupUser: async login => ({ id: login === 'me' ? '1' : '2', login, name: login.toUpperCase() }),
  channel: async login => ({ login, name: login.toUpperCase(), live: true, viewers: 30 }),
  raid: async (login) => { calls.push(['raid', login]); return { name: login.toUpperCase() }; },
  cancelRaid: async () => { calls.push(['cancelRaid']); return { ok: true }; },
});
fake('../server/media-queue', {
  playNow: (p) => { calls.push(['playNow', p.groups.length]); return 7; },
  stopIf: (id) => calls.push(['stopIf', id]),
});
fake('../server/commands/thanks', { pickBgUrl: () => '' });
const credits = require('../server/ending-credits');
Object.assign(credits, { gather: async () => groups, addAvatars: async () => {}, saveRunAt: () => calls.push(['saveRunAt']) });
process.env.TWITCH_BROADCASTER_ID = '1';
const endingRaid = require('../server/ending-raid');

const sent = [];
endingRaid.init(m => sent.push(m));
const people = n => Array.from({ length: n }, (_, i) => ({ id: String(i), login: 'v' + i, displayName: 'V' + i }));

test.beforeEach(() => { calls.length = 0; sent.length = 0; });
test.afterEach(async () => { if (endingRaid.active()) await endingRaid.stop(); });

test('the roll\'s length follows the clip player: pages of 4, headings, the longer last page', () => {
  assert.strictEqual(credits.rollMs([]), 0);
  assert.strictEqual(credits.rollMs([{ people: people(1) }]), 1000 + 550 + 10000 + 600);
  // 6 + 2 people: 2 + 1 pages, one new heading
  assert.strictEqual(credits.rollMs([{ people: people(6) }, { people: people(2) }]), 1000 + 3 * 550 + 2 * 5000 + 10000 + 1200 + 600);
});

test('the raid always goes 10 s after the roll ends', () => {
  for (const rollMs of [12150, 46000, 80000, 100000, 240000]) {
    const tl = endingRaid.timeline(rollMs);
    assert.ok(tl.rollIn >= 0 && tl.raidIn >= 0);
    assert.strictEqual(tl.landsIn - tl.raidIn, 90000);              // Twitch's countdown
    assert.strictEqual(tl.landsIn - (tl.rollIn + rollMs), 10000);   // 10 s after the roll
    assert.ok(tl.rollIn === 0 || tl.raidIn === 0);                  // one of them right away
  }
  assert.deepStrictEqual(endingRaid.timeline(46000), { rollIn: 34000, raidIn: 0, landsIn: 90000 });
  assert.deepStrictEqual(endingRaid.timeline(100000), { rollIn: 0, raidIn: 20000, landsIn: 110000 });
  assert.deepStrictEqual(endingRaid.timeline(0), { rollIn: null, raidIn: 0, landsIn: 90000 });
});

test('a short roll: the raid starts now, the roll later; Cancel stops both', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  groups = [{ key: 'chatters', people: people(4) }];   // one page: 12.15 s
  const run = await endingRaid.start('kuma');
  assert.deepStrictEqual(calls, [['raid', 'kuma']]);
  assert.strictEqual(run.rollAt - run.startedAt, 90000 - 10000 - 12150);
  t.mock.timers.tick(90000 - 10000 - 12150);
  assert.deepStrictEqual(calls.slice(1), [['saveRunAt'], ['playNow', 1]]);
  await assert.rejects(endingRaid.start('kuma'), { messageCode: 'modRaidBusy' });
  await endingRaid.stop();
  assert.deepStrictEqual(calls.slice(3), [['stopIf', 7], ['cancelRaid']]);
  assert.strictEqual(endingRaid.status(), null);
  assert.deepStrictEqual([sent.at(-1).run, sent.at(-1).stopped], [null, 'canceled']);
});

test('a long roll: the roll now, the raid later; someone raiding us stops both', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  groups = [{ key: 'subs', people: people(48) }, { key: 'chatters', people: people(8) }];   // 14 pages, one new heading: 85.5 s
  const rollMs = credits.rollMs(groups);
  await endingRaid.start('kuma');
  t.mock.timers.tick(0);
  assert.deepStrictEqual(calls, [['saveRunAt'], ['playNow', 2]]);
  t.mock.timers.tick(rollMs + 10000 - 90000);
  await new Promise(r => setImmediate(r));
  assert.deepStrictEqual(calls.at(-1), ['raid', 'kuma']);
  endingRaid.onRecord({ kind: 'notice', notice: 'resub', user: { name: 'Neko' } });   // not a raid: nothing
  assert.ok(endingRaid.active());
  endingRaid.onRecord({ kind: 'notice', notice: 'raid', user: { name: 'BigVT' } });
  await new Promise(r => setImmediate(r));
  assert.deepStrictEqual(calls.slice(-2), [['stopIf', 7], ['cancelRaid']]);
  assert.deepStrictEqual([sent.at(-1).stopped, sent.at(-1).by], ['raided', 'BigVT']);
});

test('raided before the raid started: only the roll stops; nobody to thank: a plain raid', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  groups = [{ key: 'subs', people: people(60) }];      // 15 pages: over 80 s
  await endingRaid.start('kuma');
  t.mock.timers.tick(0);
  endingRaid.onRecord({ kind: 'notice', notice: 'raid', user: { name: 'BigVT' } });
  await new Promise(r => setImmediate(r));
  assert.deepStrictEqual(calls.map(c => c[0]), ['saveRunAt', 'playNow', 'stopIf']);
  t.mock.timers.tick(200000);
  assert.ok(!calls.some(c => c[0] === 'raid'));

  calls.length = 0;
  groups = [];
  const run = await endingRaid.start('kuma');
  assert.deepStrictEqual([run.rollAt, run.landsAt - run.startedAt, calls], [null, 90000, [['raid', 'kuma']]]);
  t.mock.timers.tick(90000 + 15000);
  assert.strictEqual(endingRaid.status(), null);
  await assert.rejects(endingRaid.start('me'), { messageCode: 'modRaidSelf' });
});
