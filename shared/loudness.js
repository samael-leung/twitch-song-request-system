// shared/loudness.js — every sound file plays at the same loudness: the overlays (alerts.html,
// reward-effects.html) measure a file the first time it plays (EBU R128 / ITU BS.1770, the way
// ffmpeg's loudnorm does) and bring it to TARGET; a quiet file with sharp peaks goes through a short
// look-ahead limiter, so it can be raised without clipping. The streamer's volume slider is on top.
// The files themselves are not changed. The maths runs in Node too (test/loudness.test.js).
//   Loudness.sound(url, volume 0–1) → an Audio-like player: play(), pause(), volume,
//   addEventListener('ended' | 'error')
(function () {
  const TARGET = -16;          // LUFS
  const CEILING = 0.89;        // −1 dBFS: the limiter keeps every sample under it
  const MAX_BOOST = 20;        // dB: a near-silent file isn't blown up into noise

  // A biquad (RBJ cookbook, as pyloudnorm builds BS.1770's K-weighting): [b0, b1, b2, a1, a2]
  function biquad(type, gainDb, q, fc, rate) {
    const A = Math.pow(10, gainDb / 40), w = 2 * Math.PI * fc / rate, cos = Math.cos(w), alpha = Math.sin(w) / (2 * q);
    let b, a;
    if (type === 'shelf') {
      const s = 2 * Math.sqrt(A) * alpha;
      b = [A * ((A + 1) + (A - 1) * cos + s), -2 * A * ((A - 1) + (A + 1) * cos), A * ((A + 1) + (A - 1) * cos - s)];
      a = [(A + 1) - (A - 1) * cos + s, 2 * ((A - 1) - (A + 1) * cos), (A + 1) - (A - 1) * cos - s];
    } else {
      b = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2];
      a = [1 + alpha, -2 * cos, 1 - alpha];
    }
    return [b[0] / a[0], b[1] / a[0], b[2] / a[0], a[1] / a[0], a[2] / a[0]];
  }

  function filter(x, [b0, b1, b2, a1, a2]) {
    const y = new Float32Array(x.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) {
      const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
    }
    return y;
  }

  // Integrated loudness in LUFS (-Infinity for silence): K-weighting, 400 ms blocks every 100 ms,
  // the −70 LUFS and −10 LU gates. A file shorter than a block is one block.
  function lufs(channels, rate) {
    const shelf = biquad('shelf', 4, 1 / Math.SQRT2, 1500, rate), hp = biquad('highpass', 0, 0.5, 38, rate);
    const weighted = channels.map(c => filter(filter(c, shelf), hp));
    const n = channels[0].length, size = Math.min(n, Math.round(rate * 0.4)), step = Math.max(1, Math.round(rate * 0.1));
    if (!size) return -Infinity;
    const blocks = [];
    for (let start = 0; start + size <= n; start += step) {
      let z = 0;
      for (const c of weighted) { let s = 0; for (let i = start; i < start + size; i++) s += c[i] * c[i]; z += s / size; }
      blocks.push(z);
    }
    const loud = z => -0.691 + 10 * Math.log10(z);
    const mean = list => list.reduce((s, z) => s + z, 0) / list.length;
    const abs = blocks.filter(z => z > 0 && loud(z) > -70);
    if (!abs.length) return -Infinity;
    const rel = loud(mean(abs)) - 10;
    return loud(mean(abs.filter(z => loud(z) > rel)));
  }

  function peak(channels) {
    let p = 0;
    for (const c of channels) for (let i = 0; i < c.length; i++) { const v = Math.abs(c[i]); if (v > p) p = v; }
    return p;
  }

  // How much to raise / lower a file, and whether its peaks then need the limiter
  function plan(channels, rate) {
    const l = lufs(channels, rate), p = peak(channels);
    const gain = Number.isFinite(l) ? Math.min(Math.pow(10, (TARGET - l) / 20), Math.pow(10, MAX_BOOST / 20)) : 1;
    return { lufs: l, peak: p, gain, limit: p * gain > CEILING };
  }

  // The file with its gain, through a look-ahead limiter when its peaks would go over the ceiling:
  // the gain dips (5 ms ahead) just enough for each peak and comes back over ~80 ms
  function apply(channels, rate, gain) {
    const n = channels[0].length;
    const env = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let p = 0;
      for (const c of channels) { const v = Math.abs(c[i] * gain); if (v > p) p = v; }
      env[i] = p > CEILING ? CEILING / p : 1;
    }
    const down = 1 / Math.max(1, rate * 0.005), up = 1 / Math.max(1, rate * 0.08);
    for (let i = n - 2; i >= 0; i--) env[i] = Math.min(env[i], env[i + 1] + down);
    for (let i = 1; i < n; i++) env[i] = Math.min(env[i], env[i - 1] + up);
    return channels.map(c => { const out = new Float32Array(n); for (let i = 0; i < n; i++) out[i] = c[i] * gain * env[i]; return out; });
  }

  const maths = { TARGET, CEILING, lufs, peak, plan, apply };
  if (typeof module !== 'undefined' && module.exports) { module.exports = maths; return; }

  // ---- In the overlay ----
  let ctx;
  const ready = new Map();   // url → Promise of the evened-out AudioBuffer (null: play the file as it is)
  const KEEP = 16;

  function prepare(url) {
    if (ready.has(url)) return ready.get(url);
    const job = (async () => {
      ctx = ctx || new AudioContext();
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const buf = await ctx.decodeAudioData(await res.arrayBuffer());
      const channels = Array.from({ length: buf.numberOfChannels }, (_, i) => buf.getChannelData(i));
      const p = plan(channels, buf.sampleRate);
      const out = ctx.createBuffer(channels.length, buf.length, buf.sampleRate);
      apply(channels, buf.sampleRate, p.gain).forEach((c, i) => out.copyToChannel(c, i));
      console.log(`[loudness] ${decodeURIComponent(url.split('/').pop())}: ${p.lufs.toFixed(1)} LUFS → ${TARGET}${p.limit ? ' (limited)' : ''}`);
      return out;
    })().catch((err) => { console.warn('[loudness] playing as it is:', url, err.message); return null; });
    ready.set(url, job);
    if (ready.size > KEEP) ready.delete(ready.keys().next().value);
    return job;
  }

  // Plays the evened-out copy through Web Audio; when that can't run (a file the browser can't decode,
  // or sound not allowed yet), the file itself in an <audio>, as before
  function sound(url, volume = 1) {
    const events = new EventTarget();
    let vol = volume, node = null, gainNode = null, plain = null, stopped = false;
    const emit = type => events.dispatchEvent(new Event(type));
    return {
      addEventListener: (type, fn) => events.addEventListener(type, fn),
      get volume() { return vol; },
      set volume(v) { vol = v; if (gainNode) gainNode.gain.value = v; if (plain) plain.volume = v; },
      async play() {
        const buf = await prepare(url);
        if (stopped) return;
        if (buf && ctx.state !== 'running') await Promise.race([ctx.resume().catch(() => {}), new Promise(r => setTimeout(r, 300))]);
        if (buf && ctx.state === 'running') {
          node = ctx.createBufferSource();
          node.buffer = buf;
          gainNode = ctx.createGain();
          gainNode.gain.value = vol;
          node.connect(gainNode).connect(ctx.destination);
          node.onended = () => { if (!stopped) emit('ended'); };
          node.start();
          return;
        }
        plain = new Audio(url);
        plain.volume = vol;
        plain.addEventListener('ended', () => emit('ended'));
        plain.addEventListener('error', () => emit('error'));
        return plain.play().catch((err) => { emit('error'); throw err; });
      },
      pause() {
        stopped = true;
        try { if (node) node.stop(); } catch (_) {}
        if (plain) plain.pause();
      },
    };
  }

  window.Loudness = { ...maths, prepare, sound };
})();
