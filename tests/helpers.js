'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const server = path.resolve(__dirname, '../server');
const source = fs.readFileSync(path.join(server, 'queue.js'), 'utf8');

// Each test gets the real queue implementation with an isolated persistence file.
function loadQueue(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'leihu-queue-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'queue-state.json');
  function reload() {
    const module = { exports: {} };
    vm.runInNewContext(source, { module, exports: module.exports, console, Date, Set, require,
      __dirname: server, process: { env: { QUEUE_STATE_FILE: file } } });
    return module.exports;
  }
  return { queue: reload(), file, reload };
}
module.exports = { loadQueue };
