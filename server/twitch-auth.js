const express = require('express');
const crypto = require('node:crypto');

module.exports = function twitchAuth(connection, env = process.env) {
  const router = express.Router();
  const states = new Map();
  router.use((req, res, next) => {
    const address = req.socket.remoteAddress;
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address)) return res.sendStatus(403);
    res.set('Cache-Control', 'no-store');
    res.set('Referrer-Policy', 'no-referrer');
    next();
  });
  router.get('/', (req, res) => {
    if (connection.getStatus().transport !== 'websocket') return res.status(409).send('Use TWITCH_TRANSPORT=websocket for browser authorization.');
    const redirect = new URL(env.TWITCH_REDIRECT_URI || `http://localhost:${env.PORT || 3000}/auth/twitch/callback`);
    // The cookie and the OAuth callback must use the same host.
    if (req.get('host') !== redirect.host) return res.redirect(redirect.origin + '/auth/twitch');
    for (const [key, expiry] of states) if (expiry < Date.now()) states.delete(key);
    if (states.size >= 100) return res.status(429).send('Too many authorization attempts.');
    const state = crypto.randomBytes(24).toString('hex');
    states.set(state, Date.now() + 600000);
    res.cookie('twitch_oauth_state', state, { httpOnly: true, sameSite: 'lax', maxAge: 600000, path: '/auth/twitch' });
    const url = new URL('https://id.twitch.tv/oauth2/authorize');
    url.search = new URLSearchParams({ client_id: env.TWITCH_CLIENT_ID,
      redirect_uri: redirect.href, response_type: 'token', scope: 'channel:read:redemptions', force_verify: 'true', state }).toString();
    res.redirect(url.href);
  });
  router.get('/callback', (req, res) => {
    res.set('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; connect-src 'self'");
    res.type('html').send(`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>Twitch 授權</title>
<p id="status">連接 Twitch 中…</p><script>
(async () => {
 const params = new URLSearchParams(location.hash.slice(1));
 history.replaceState(null, '', location.pathname);
 const el = document.getElementById('status');
 try {
  if (!params.get('access_token')) throw new Error('Twitch 授權未完成，請重新開啟 /auth/twitch。');
  const response = await fetch('/auth/twitch/complete', { method: 'POST', headers: {'Content-Type':'application/json'},
   body: JSON.stringify({token: params.get('access_token'), state: params.get('state')}) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error);
  el.textContent = '授權已儲存，正在連接 Twitch。可返回控制台；連線狀態請見 /api/twitch/status。';
 } catch (error) { el.textContent = error.message; }
})();
</script></html>`);
  });
  router.post('/complete', async (req, res) => {
    const { token, state } = req.body || {};
    const cookie = /(?:^|;\s*)twitch_oauth_state=([^;]+)/.exec(req.headers.cookie || '')?.[1];
    if (!req.is('application/json') || typeof state !== 'string' || state !== cookie ||
        !states.has(state) || states.get(state) < Date.now()) {
      return res.status(403).json({ error: 'Authorization expired or invalid. Open /auth/twitch again.' });
    }
    states.delete(state);
    res.clearCookie('twitch_oauth_state', { path: '/auth/twitch' });
    if (typeof token !== 'string' || !/^[A-Za-z0-9]+$/.test(token)) return res.status(400).json({ error: 'Invalid token.' });
    try { await connection.authorize(token, true); res.json({ ok: true }); }
    catch (error) { res.status(400).json({ error: error.message }); }
  });
  return router;
};
