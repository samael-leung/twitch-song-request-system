const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const WebSocket = require('ws');

test('real server serves dashboard, queue and selection API while awaiting broadcaster authorization', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'song-server-'));
  const child = spawn(process.execPath, [path.resolve(__dirname, '../server/index.js')], {
    cwd: dir, env: { ...process.env, PORT: '0', TWITCH_TRANSPORT: 'websocket',
      TWITCH_CLIENT_ID: 'startup-test-client', TWITCH_USER_ACCESS_TOKEN: '',
      GOOGLE_SHEET_ID: '', HISTORY_SHEET_ID: '' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let ws;
  t.after(async () => {
    ws?.terminate();
    if (child.exitCode === null) { const exited = once(child, 'exit'); child.kill('SIGTERM'); await exited; }
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const port = await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error('Server startup timed out')), 10000);
    child.stdout.on('data', value => {
      output += value;
      const match = output.match(/Server running at http:\/\/localhost:(\d+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Server exited: ${code}`)); });
  });
  const base = `http://127.0.0.1:${port}`;
  assert.match(await (await fetch(base + '/dashboard/')).text(), /twitch-connect/);
  assert.equal((await fetch(base + '/overlay/index.html')).status, 200);
  const status = await (await fetch(base + '/api/twitch/status')).json();
  assert.equal(status.transport, 'websocket');
  assert.equal(status.status, 'authorization_required');
  assert.equal(JSON.stringify(status).includes('access_token'), false);
  assert.deepEqual((await (await fetch(base + '/api/queue')).json()).queue, []);
  ws = new WebSocket(base.replace('http:', 'ws:'));
  const [raw] = await once(ws, 'message');
  assert.equal(JSON.parse(raw).type, 'state');
  const selection = await (await fetch(base + '/api/integrations/leihu/selection')).json();
  const broadcast = once(ws, 'message');
  const response = await fetch(base + '/api/integrations/leihu/selection', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expectedRevision: selection.revision, song: { id: 'local', title: '本機雙向同步' } }),
  });
  assert.equal(response.status, 200);
  assert.equal(JSON.parse((await broadcast)[0]).nowPlaying.title, '本機雙向同步');
  assert.equal((await (await fetch(base + '/api/queue')).json()).nowPlaying.leihuId, 'local');
  assert.equal((await fetch(base + '/twitch/webhook', { method: 'POST' })).status, 403);
});
