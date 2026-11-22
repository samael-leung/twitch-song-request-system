// shared/theme.js — puts a page in one of the five looks (shared/themes.css) and its text size.
// The dashboard and the overlays each have their own (🎨 Look & overlays in the dashboard's top bar, saved by the server);
// an overlay's URL can pick another with ?theme=. A look's fonts load when it's first used and then stay:
// each font is asked for once, the same way for every look, and never removed — swapping a font's
// stylesheet under text already on screen made Streamlabs' browser (Chromium 128) draw wrong pieces of
// letters until the next switch. The last look is kept in this browser so the page starts in it
// instead of flashing Neon first.
//
//   Theme.apply('ocean')            the look (unknown names: Neon)
//   Theme.scale(1.2)                text size: sets --ts, which the page's font sizes multiply
//   Theme.nameColor('#1E90FF')      a Twitch name colour readable on this look's background
(function () {
  const THEMES = ['neon', 'daylight', 'contrast', 'ocean', 'coffee'];
  const LIGHT = ['daylight', 'coffee'];
  // Each font, the one way it's asked for; each look's fonts
  const FAMILIES = {
    orbitron: 'Orbitron:wght@400;500;700',
    sharetech: 'Share+Tech+Mono',
    notosans: 'Noto+Sans+TC:wght@400;500;700',
    atkinson: 'Atkinson+Hyperlegible:wght@400;700',
    exo: 'Exo+2:wght@400;500;700',
    notoserif: 'Noto+Serif+TC:wght@500;700',
  };
  const FONTS = {
    neon: ['orbitron', 'sharetech'],
    daylight: ['notosans'],
    contrast: ['atkinson', 'notosans'],
    ocean: ['exo', 'notosans'],
    coffee: ['notoserif', 'notosans'],
  };
  const root = document.documentElement;
  const surface = root.dataset.surface || 'dashboard';
  const forced = new URLSearchParams(location.search).get('theme');   // an overlay's own look
  const remember = (key, value) => { try { localStorage.setItem(key, value); } catch (_) {} };
  const recall = (key) => { try { return localStorage.getItem(key); } catch (_) { return null; } };

  let current = null;
  let listeners = [];

  function loadFonts(name) {
    if (root.dataset.fonts === 'none') return;   // a page with fonts of its own (the clip player)
    for (const family of FONTS[name]) {
      const id = 'theme-font-' + family;
      if (document.getElementById(id)) continue;   // already here: never swapped or removed
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${FAMILIES[family]}&display=swap`;
      document.head.appendChild(link);
    }
  }

  function apply(name) {
    if (THEMES.includes(forced)) name = forced;
    if (!THEMES.includes(name)) name = 'neon';
    if (name === current) return;
    current = name;
    root.dataset.theme = name;
    loadFonts(name);
    if (!THEMES.includes(forced)) remember(`theme.${surface}`, name);
    for (const fn of listeners) fn(name);
  }

  function scale(n) {
    const v = Number(n);
    if (!Number.isFinite(v) || v <= 0) return;
    root.style.setProperty('--ts', String(v));
    remember(`theme.ts.${location.pathname}`, String(v));   // each overlay its own size
  }

  // Twitch name colours: on a light look, pale ones are darkened; on a dark one, very dark ones lightened
  function nameColor(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    let [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255];
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const light = LIGHT.includes(current);
    let k = 1;
    if (light && lum > 0.55) k = 0.55 / lum;        // towards black
    if (!light && lum < 0.3) {                     // towards white
      const t = (0.3 - lum) / 0.3 * 0.6;
      [r, g, b] = [r, g, b].map(c => c + (255 - c) * t);
    }
    const hex2 = c => Math.round(c * k).toString(16).padStart(2, '0');
    return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
  }

  window.Theme = {
    THEMES,
    apply,
    scale,
    nameColor,
    get current() { return current; },
    isLight: () => LIGHT.includes(current),
    onChange(fn) { listeners.push(fn); },
  };

  apply(recall(`theme.${surface}`) || 'neon');
  const ts = recall(`theme.ts.${location.pathname}`);
  if (ts) scale(ts);
})();
