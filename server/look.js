// server/look.js
// 🎨 Look & overlays (the dashboard's top bar): the dashboard's and the overlays' themes (shared/themes.css) and text sizes,
// kept in .env. The dashboard's are shared by every browser and phone that opens it. Each
// overlay has its own text size (the chat overlay keeps its own setting, CHAT_OVERLAY_SIZE); an
// overlay's Browser Source size never changes with it.

const { UserError } = require('./messages');

const THEMES = ['neon', 'daylight', 'contrast', 'ocean', 'coffee'];
const SETTINGS = {
  dashboardTheme:     { env: 'DASHBOARD_THEME', theme: true },
  dashboardTextScale: { env: 'DASHBOARD_TEXT_SCALE', min: 0.85, max: 1.4 },
  overlayTheme:       { env: 'OVERLAY_THEME', theme: true },
  songTextScale:      { env: 'OVERLAY_SONG_TEXT_SCALE', min: 0.8, max: 1.25 },
  breakTextScale:     { env: 'OVERLAY_BREAK_TEXT_SCALE', min: 0.8, max: 1.1 },   // the card is full: it keeps 960 × 260
};

// { dashboardTheme: 'neon', dashboardTextScale: 1, … }; anything unset or out of range is the default
function read(env = process.env) {
  const out = {};
  for (const [key, s] of Object.entries(SETTINGS)) {
    const raw = env[s.env];
    if (s.theme) out[key] = THEMES.includes(raw) ? raw : 'neon';
    else {
      const n = parseFloat(raw);
      out[key] = Number.isFinite(n) && n >= s.min && n <= s.max ? n : 1;
    }
  }
  return out;
}

// A change from the dashboard → { values, env } (the .env lines to write); a bad one is refused
function parse(changes) {
  if (!changes || typeof changes !== 'object') throw new UserError('lookBadSetting', {}, 'look must be an object');
  const values = {}, env = {};
  for (const [key, value] of Object.entries(changes)) {
    const s = SETTINGS[key];
    if (!s) throw new UserError('lookBadSetting', {}, `unknown look setting ${key}`);
    if (s.theme) {
      if (!THEMES.includes(value)) throw new UserError('lookBadSetting', {}, `${key} must be one of ${THEMES.join(', ')}`);
      values[key] = value;
    } else {
      const n = Math.round(Number(value) * 100) / 100;
      if (!Number.isFinite(n) || n < s.min || n > s.max) throw new UserError('lookBadSetting', {}, `${key} must be from ${s.min} to ${s.max}`);
      values[key] = n;
    }
    env[s.env] = String(values[key]);
  }
  return { values, env };
}

module.exports = { THEMES, SETTINGS, read, parse };
