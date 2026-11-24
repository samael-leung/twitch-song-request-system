const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const http = require('node:http');
const { EventEmitter } = require('node:events');
const express = require('express');
const messages = require('../server/messages');

// Exercise the shipped routes over HTTP. Only the Windows process boundary is mocked.
async function fixture(t, { configured = true, browser = 'chrome' } = {}) {
  const launched = [], folders = [], logs = [], errors = [];
  const module = { exports: {} };
  const spawn = (file, args, options) => {
    launched.push({ file, args, options });
    const child = new EventEmitter(); child.unref = () => {};
    return child;
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../server/stream-window.js'), 'utf8'), {
    module, process: { platform: 'win32', env: { PROGRAMFILES: 'C:\\Program Files', LOCALAPPDATA: 'C:\\Users\\fixture\\AppData\\Local' } },
    console: { log: value => logs.push(value), error: (...values) => errors.push(values.join(' ')) },
    require: name => ({ fs: { existsSync: file => browser === 'chrome' ? file.endsWith('chrome.exe')
      : browser === 'edge' && file.endsWith('msedge.exe'), mkdirSync: folder => folders.push(folder) },
      path: path.win32, child_process: { spawn }, './messages': messages })[name],
  });
  const app = express(); app.use(express.json());
  const server = http.createServer(app);
  const source = fs.readFileSync(path.join(__dirname, '../server/index.js'), 'utf8');
  const routes = source.slice(source.indexOf("app.post('/api/open-in-browser'"), source.indexOf('// Prepare every sheet song'));
  vm.runInNewContext(routes, { app, server, PORT: 0, isSetupComplete: () => configured,
    streamWindow: module.exports, errorBody: messages.errorBody,
    console: { error: (...values) => errors.push(values.join(' ')) } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;
  const post = (endpoint, body) => fetch(`http://127.0.0.1:${port}${endpoint}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return { port, post, launched, folders, logs, errors };
}

test('startup opens an isolated Chrome dashboard at the actual listening port and logs success', async t => {
  const s = await fixture(t);
  const response = await s.post('/api/stream-window', { tab: 'queue', lang: 'zh-TW' });
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal((await response.json()).browser, 'chrome');
  assert.equal(s.launched.length, 1);
  const launch = s.launched[0];
  assert.equal(launch.args.at(-1), `--app=http://localhost:${s.port}/dashboard?window=stream&lang=zh-TW`);
  assert.ok(launch.args.some(arg => arg.startsWith('--user-data-dir=') && arg.includes('SongRequestDashboard')));
  assert.equal(launch.options.detached, true);
  assert.equal(s.folders.length, 1);
  assert.ok(s.logs.includes('[stream-window] Opened the dashboard in its own window (chrome.exe)'));
  assert.deepEqual(s.errors, []);
});

test('manual Leihu-window opening retains its tab, language and Edge fallback', async t => {
  const s = await fixture(t, { browser: 'edge' });
  const response = await s.post('/api/stream-window', { lang: 'en' });
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal((await response.json()).browser, 'msedge');
  assert.equal(s.launched[0].args.at(-1), `--app=http://localhost:${s.port}/dashboard?window=stream&lang=en#leihu`);
});

test('setup-incomplete startup keeps the wizard path and never launches an app window', async t => {
  const s = await fixture(t, { configured: false });
  assert.equal((await s.post('/api/stream-window', { tab: 'queue' })).status, 409);
  assert.equal(s.launched.length, 0);
});

test('missing Chrome and Edge returns the actionable error instead of claiming a window opened', async t => {
  const s = await fixture(t, { browser: null });
  const response = await s.post('/api/stream-window', { tab: 'queue' });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'streamWindowNoBrowser');
  assert.equal(s.launched.length, 0);
  assert.equal(s.logs.length, 0);
  assert.ok(s.errors.some(line => line.includes('Chrome or Edge was not found')));
});
