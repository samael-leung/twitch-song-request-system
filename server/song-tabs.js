// server/song-tabs.js
// Song Queue ⚙: which sheet tabs viewers can request from (EXCLUDED_TABS, read through config.js)
// and how the random reward picks (RANDOM_PICK_MODE). The first tab left out is also where
// Pending's "add to sheet" puts songs, so saving keeps the left-out tabs in their order.

const config = require('./config');
const { UserError } = require('./messages');

const PICK_MODES = ['weighted', 'pure'];

function pickMode(env = process.env) {
  const mode = String(env.RANDOM_PICK_MODE || '').toLowerCase();
  return PICK_MODES.includes(mode) ? mode : 'weighted';
}

// The tabs to leave out, for `excluded` (tab names): the ones already left out keep their place,
// new ones follow. config.js splits EXCLUDED_TABS at commas, so a name with one can't be saved.
function excludedList(excluded, current = config.EXCLUDED_TABS) {
  if (!Array.isArray(excluded)) throw new UserError('tabsBad', {}, 'excludedTabs must be a list of tab names');
  const names = [...new Set(excluded.map(n => String(n).trim()).filter(Boolean))];
  const comma = names.find(n => /[,，\r\n]/.test(n));
  if (comma) throw new UserError('tabNameComma', { tab: comma }, `The tab "${comma}" has a comma in its name — rename it in the sheet to leave it out.`);
  return [...current.filter(n => names.includes(n)), ...names.filter(n => !current.includes(n))];
}

function parsePickMode(mode) {
  if (!PICK_MODES.includes(mode)) throw new UserError('pickModeBad', {}, `randomPickMode must be one of ${PICK_MODES.join(', ')}`);
  return mode;
}

module.exports = { PICK_MODES, pickMode, excludedList, parsePickMode };
