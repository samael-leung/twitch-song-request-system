const axios = require('axios');
const fs = require('node:fs');
const path = require('node:path');
const { createEventSubSocket } = require('./twitch-websocket');

function createTwitchConnection({ onRedemption, env = process.env, api = axios,
  sessionFile = path.join(__dirname, '..', 'twitch-session.json'), socketFactory = createEventSubSocket }) {
  let connection;
  let validationTimer;
  let state = { status: 'starting', transport: env.TWITCH_TRANSPORT || 'websocket' };
  const status = (value, message) => {
    state = { ...state, status: value, ...(message ? { message } : { message: undefined }) };
    console.log(`[twitch] ${value}${message ? ': ' + message : ''}`);
  };
  async function validate(token) {
    let data;
    try {
      ({ data } = await api.get('https://id.twitch.tv/oauth2/validate', {
        headers: { Authorization: `OAuth ${token}` }, timeout: 10000,
      }));
    } catch { throw new Error('Unable to validate Twitch authorization; check access or sign in again.'); }
    if (data.client_id !== env.TWITCH_CLIENT_ID || !data.user_id ||
        (env.TWITCH_BROADCASTER_ID && env.TWITCH_BROADCASTER_ID !== data.user_id) ||
        !data.scopes?.some(scope => ['channel:read:redemptions', 'channel:manage:redemptions'].includes(scope))) {
      throw new Error('Authorize the configured broadcaster with channel:read:redemptions.');
    }
    return data;
  }
  async function authorize(token, persist = false) {
    const data = await validate(token);
    if (persist) {
      // Store browser authorization only in the ignored local credential file.
      const tmp = sessionFile + '.tmp';
      try {
        fs.writeFileSync(tmp, JSON.stringify({ clientId: data.client_id, token }), { mode: 0o600 });
        fs.renameSync(tmp, sessionFile);
      } catch { throw new Error('Unable to save local Twitch authorization.'); }
    }
    connection?.stop();
    clearInterval(validationTimer);
    status('connecting');
    connection = socketFactory({ token, clientId: data.client_id, broadcasterId: data.user_id,
      onRedemption, onStatus: status, api });
    // Twitch requires validation at startup and at least hourly thereafter.
    validationTimer = setInterval(async () => {
      const activeConnection = connection;
      try { await validate(token); }
      catch (error) {
        if (connection !== activeConnection) return;
        connection?.stop(); clearInterval(validationTimer); status('authorization_required', error.message);
      }
    }, 60 * 60 * 1000);
    validationTimer.unref?.();
  }
  async function start() {
    if (!['websocket', 'webhook'].includes(state.transport)) throw new Error('TWITCH_TRANSPORT must be websocket or webhook.');
    if (state.transport === 'webhook') {
      await require('./twitch').registerEventSub();
      status('webhook');
      return;
    }
    if (!env.TWITCH_CLIENT_ID || env.TWITCH_CLIENT_ID.startsWith('your_')) {
      throw new Error('Set TWITCH_CLIENT_ID to your Twitch application Client ID, then start again.');
    }
    let token = env.TWITCH_USER_ACCESS_TOKEN;
    if (!token && fs.existsSync(sessionFile)) {
      try {
        const saved = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
        if (saved.clientId === env.TWITCH_CLIENT_ID) token = saved.token;
      } catch { status('authorization_required', 'Local authorization file is unreadable; sign in again.'); }
    }
    if (!token) {
      status('authorization_required', 'Open /auth/twitch in the local browser to connect Twitch.');
      return;
    }
    try { await authorize(token); }
    catch (error) { status('authorization_required', error.message); }
  }
  return { start, authorize, getStatus: () => state,
    stop: () => { clearInterval(validationTimer); connection?.stop(); } };
}
module.exports = { createTwitchConnection };
