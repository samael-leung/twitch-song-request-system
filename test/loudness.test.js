// shared/loudness.js: every sound file is evened out to the same loudness in the overlays
const test = require('node:test');
const assert = require('node:assert');
const L = require('../shared/loudness');

const RATE = 48000;
// A stereo 1 kHz sine, `seconds` long, at amplitude `amp`, with an optional click at full scale
function sine(amp, seconds = 3, click = false) {
  const n = RATE * seconds;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = amp * Math.sin(2 * Math.PI * 1000 * i / RATE);
  if (click) c[RATE] = 1;
  return [c, c.slice()];
}
const db = v => 20 * Math.log10(v);

test('loudness is measured like BS.1770: a stereo 1 kHz sine at amplitude 0.1 is about −20 LUFS', () => {
  assert.ok(Math.abs(L.lufs(sine(0.1), RATE) + 20) < 0.3, String(L.lufs(sine(0.1), RATE)));
  assert.ok(Math.abs(L.lufs(sine(0.01), RATE) + 40) < 0.3);
  assert.strictEqual(L.lufs([new Float32Array(RATE)], RATE), -Infinity);   // silence
  assert.ok(Number.isFinite(L.lufs(sine(0.1, 0.2), RATE)));               // shorter than a block
});

test('a loud and a quiet file both come out at the target, without going over the ceiling', () => {
  for (const amp of [0.9, 0.03]) {
    const ch = sine(amp);
    const p = L.plan(ch, RATE);
    const out = L.apply(ch, RATE, p.gain);
    assert.ok(Math.abs(L.lufs(out, RATE) - L.TARGET) < 0.3, `amp ${amp}: ${L.lufs(out, RATE)}`);
    assert.ok(L.peak(out) <= L.CEILING + 1e-6);
  }
});

test('a quiet file with a sharp peak is raised and limited; silence is left alone', () => {
  const ch = sine(0.03, 3, true);
  const p = L.plan(ch, RATE);
  assert.ok(p.limit && p.gain > 3);
  const out = L.apply(ch, RATE, p.gain);
  assert.ok(L.peak(out) <= L.CEILING + 1e-6, String(db(L.peak(out))));
  assert.ok(Math.abs(L.lufs(out, RATE) - L.TARGET) < 0.5);
  assert.strictEqual(L.plan([new Float32Array(RATE)], RATE).gain, 1);
  assert.ok(db(L.plan(sine(0.0001), RATE).gain) <= 20.001);   // near-silence: at most +20 dB
});
