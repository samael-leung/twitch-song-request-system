const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const { createTwitchConnection } = require('../server/twitch-connection');

function connectionFixture(t, override = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'twitch-auth-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const sessions = [], validations = [];
  const options = { env: { TWITCH_CLIENT_ID: 'client', TWITCH_BROADCASTER_ID: 'broadcaster' },
    sessionFile: path.join(dir, 'session.json'),
    api: { get: async (...args) => {
      validations.push(args);
      return { data: { client_id: 'client', user_id: 'broadcaster', scopes: ['channel:read:redemptions'] } };
    } },
    onRedemption: () => {},
    socketFactory: value => { sessions.push(value); return { stop: () => {} }; }, ...override };
  const connection = createTwitchConnection(options);
  t.after(() => connection.stop());
  return { connection, options, sessions, validations };
}

test('initial login is required; browser authorization is validated, saved and restored', async t => {
  const f = connectionFixture(t);
  await f.connection.start();
  assert.equal(f.connection.getStatus().status, 'authorization_required');
  assert.equal(f.validations.length, 0); // No client-credentials request before user authorization.
  await f.connection.authorize('browserToken', true);
  assert.equal(f.validations[0][1].headers.Authorization, 'OAuth browserToken');
  assert.equal(f.sessions[0].broadcasterId, 'broadcaster');
  assert.equal(JSON.parse(fs.readFileSync(f.options.sessionFile)).token, 'browserToken');
  assert.equal(fs.statSync(f.options.sessionFile).mode & 0o777, 0o600);
  const restored = createTwitchConnection(f.options); t.after(() => restored.stop());
  await restored.start(); assert.equal(f.sessions.length, 2);
});

test('rejects wrong app, broadcaster, missing scope and missing client ID without saving', async t => {
  for (const data of [
    { client_id: 'wrong', user_id: 'broadcaster', scopes: ['channel:read:redemptions'] },
    { client_id: 'client', user_id: 'someone-else', scopes: ['channel:read:redemptions'] },
    { client_id: 'client', user_id: 'broadcaster', scopes: [] },
  ]) {
    const f = connectionFixture(t, { api: { get: async () => ({ data }) } });
    await assert.rejects(f.connection.authorize('badToken', true), /broadcaster/);
    assert.equal(fs.existsSync(f.options.sessionFile), false);
    assert.equal(f.sessions.length, 0);
  }
  const missing = connectionFixture(t, { env: {} });
  await assert.rejects(missing.connection.start(), /TWITCH_CLIENT_ID/);
});

test('OAuth flow checks state/cookie and consumes it once; callback clears the URL fragment', async t => {
  const f = connectionFixture(t);
  const app = express(); app.use(express.json());
  const env = { TWITCH_CLIENT_ID: 'client' };
  app.use('/auth/twitch', require('../server/twitch-auth')(f.connection, env));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  env.TWITCH_REDIRECT_URI = base + '/auth/twitch/callback';
  const login = await fetch(base + '/auth/twitch', { redirect: 'manual' });
  const url = new URL(login.headers.get('location'));
  assert.equal(url.origin, 'https://id.twitch.tv');
  assert.equal(url.searchParams.get('scope'), 'channel:read:redemptions');
  assert.equal(url.searchParams.get('redirect_uri'), env.TWITCH_REDIRECT_URI);
  const state = url.searchParams.get('state');
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const complete = (state, headers = {}) => fetch(base + '/auth/twitch/complete', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ state, token: 'browserToken' }),
  });
  assert.equal((await complete(state)).status, 403);
  assert.equal((await complete('wrong', { Cookie: cookie })).status, 403);
  assert.equal((await complete(state, { Cookie: cookie })).status, 200);
  assert.equal((await complete(state, { Cookie: cookie })).status, 403);
  const callback = await fetch(base + '/auth/twitch/callback');
  assert.equal(callback.headers.get('cache-control'), 'no-store');
  assert.match(await callback.text(), /history.replaceState/);
});
