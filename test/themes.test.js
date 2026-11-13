const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const look = require('../server/look');

const ROOT = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
// Pages drawn in the themes (shared/themes.css)
const PAGES = ['dashboard/index.html', 'dashboard/links.html', 'overlay/index.html', 'overlay/chat.html', 'overlay/break.html',
  'clip-player/index.html', 'setup/setup.css'];

// "name: value" of each block of themes.css, by its first selector
function themeBlocks() {
  const css = read('shared/themes.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks = {};
  for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const sel = m[1].trim().split(',').pop().trim();
    const vars = [...m[2].matchAll(/(--[\w-]+)\s*:/g)].map(v => v[1]);
    blocks[sel] = new Set(vars);
  }
  return blocks;
}

test('look settings: themes and text sizes are checked, defaults when unset', () => {
  assert.deepStrictEqual(look.read({}), { dashboardTheme: 'neon', dashboardTextScale: 1, overlayTheme: 'neon', songTextScale: 1, breakTextScale: 1 });
  assert.deepStrictEqual(look.read({ DASHBOARD_THEME: 'ocean', DASHBOARD_TEXT_SCALE: '1.2', OVERLAY_THEME: 'nope', OVERLAY_SONG_TEXT_SCALE: '3' }),
    { dashboardTheme: 'ocean', dashboardTextScale: 1.2, overlayTheme: 'neon', songTextScale: 1, breakTextScale: 1 });
  assert.deepStrictEqual(look.parse({ overlayTheme: 'coffee', songTextScale: '1.1' }),
    { values: { overlayTheme: 'coffee', songTextScale: 1.1 }, env: { OVERLAY_THEME: 'coffee', OVERLAY_SONG_TEXT_SCALE: '1.1' } });
  for (const bad of [{ dashboardTheme: 'pink' }, { dashboardTextScale: 2 }, { breakTextScale: 0.5 }, { colour: 'red' }, null]) {
    assert.throws(() => look.parse(bad), { messageCode: 'lookBadSetting' });
  }
});

test('every theme sets every token, for the dashboard and for the overlays', () => {
  const blocks = themeBlocks();
  const base = blocks[':root[data-theme="neon"]'] || blocks['[data-theme-card="neon"]'];
  const overlay = blocks[':root[data-surface="overlay"][data-theme="neon"]'];
  assert.ok(base && base.size > 40 && overlay && overlay.size > 10);
  for (const name of look.THEMES.filter(n => n !== 'neon')) {
    const b = blocks[`[data-theme-card="${name}"]`];
    const o = blocks[`:root[data-surface="overlay"][data-theme="${name}"]`];
    assert.deepStrictEqual([...base].filter(v => !b.has(v)), [], `${name} is missing tokens`);
    assert.deepStrictEqual([...overlay].filter(v => !o.has(v)), [], `${name} (overlay) is missing tokens`);
  }
  // shared/theme.js knows the same five
  assert.match(read('shared/theme.js'), /THEMES = \['neon', 'daylight', 'contrast', 'ocean', 'coffee'\]/);
});

test('a page\'s own value for a theme token outranks the theme', () => {
  // A plain ":root { --bg-panel: … }" loses to themes.css's ":root[data-theme=…]" (the overlays' see-through panel did)
  const theme = new Set(Object.values(themeBlocks()).flatMap(s => [...s]));
  for (const page of PAGES) {
    for (const m of read(page).matchAll(/(^|[}\s])(:root[^{]*)\{([^}]*)\}/g)) {
      if (/data-surface/.test(m[2])) continue;
      const clash = [...m[3].matchAll(/(--[\w-]+)\s*:/g)].map(v => v[1]).filter(v => theme.has(v));
      assert.deepStrictEqual(clash, [], `${page}: ${m[2].trim()} sets ${clash.join(', ')} — use :root[data-surface="overlay"]`);
    }
  }
});

test('pages use the theme tokens, not colours of their own', () => {
  const blocks = themeBlocks();
  const defined = new Set(Object.values(blocks).flatMap(s => [...s]));
  for (const page of PAGES) {
    const lines = read(page).split(/\r?\n/);
    // the page's own: set in its CSS or by its script (--ts, --size, --scroll-dist…)
    const own = new Set([...lines.join('\n').replace(/var\(--/g, '').matchAll(/--[\w-]+/g)].map(m => m[0]));
    lines.forEach((line, i) => {
      const where = `${page}:${i + 1}`;
      // Colours that follow no theme are marked "any theme" (outlines over the stream, Twitch's name colours…)
      if (/any theme/.test(line) || /any theme/.test(lines[i - 1] || '')) return;
      for (const m of line.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b(?![\w-])|rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/gi)) {
        let rgb;
        if (m[1]) {
          const h = m[1].length === 3 ? m[1].replace(/./g, c => c + c) : m[1];
          rgb = [0, 2, 4].map(k => parseInt(h.slice(k, k + 2), 16));
        } else rgb = [m[2], m[3], m[4]].map(Number);
        // black, white and greys are fine (shadows, outlines over video); anything else is a theme's
        assert.ok(rgb[0] === rgb[1] && rgb[1] === rgb[2], `${where}: typed colour ${m[0]} — use a token from shared/themes.css`);
      }
      for (const m of line.matchAll(/var\((--[\w-]+)/g)) {
        assert.ok(defined.has(m[1]) || own.has(m[1]), `${where}: ${m[1]} isn't a theme token`);
      }
      assert.doesNotMatch(line, /--(purple|green|amber|orange|blue|red)\b(?!-rgb)/, `${where}: an old colour name`);
    });
  }
});
