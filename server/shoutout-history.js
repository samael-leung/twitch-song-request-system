// server/shoutout-history.js
// In-memory store for broadcasters shouted out since the last !tk.
// getAndClear() returns all entries and resets the list; restore() puts back a roll's that didn't play.

const history = []; // { login, displayName, avatarUrl }

function addShoutout(login, displayName, avatarUrl) {
  if (!history.find(h => h.login.toLowerCase() === login.toLowerCase())) {
    history.push({ login, displayName, avatarUrl });
    console.log(`[shoutout-history] Added: ${displayName} (${history.length} total)`);
  }
}

function getAndClear() {
  return history.splice(0);
}

// A !tk roll that was dropped before it played: its broadcasters are waiting to be thanked again,
// ahead of anyone shouted out since
function restore(list) {
  const back = list.filter(b => !history.find(h => h.login.toLowerCase() === b.login.toLowerCase()));
  history.unshift(...back);
  if (back.length) console.log(`[shoutout-history] Back on the !tk list: ${back.map(b => b.displayName).join(', ')} (${history.length} total)`);
}

module.exports = { addShoutout, getAndClear, restore };
