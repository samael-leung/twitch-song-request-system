// shared/chat-bots.js — common chat bots (logins): hidden in the dashboard's chat while "Hide bots"
// is on, and in the on-stream chat (overlay/chat.html) unless its settings show them.
(function (bots) {
  if (typeof module !== 'undefined' && module.exports) module.exports = bots;
  else window.CHAT_BOTS = bots;
})(['nightbot', 'streamelements', 'moobot', 'fossabot', 'wizebot', 'streamlabs', 'soundalerts',
  'sery_bot', 'botrixoficial', 'kofistreambot', 'commanderroot', 'streamstickers', 'pokemoncommunitygame']);
