const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('Windows native launcher prefers a completed secure-runtime and falls back for incomplete migrations', () => {
  const root = 'F:\\LeihuLiantai', win = path.win32, files = new Set();
  const module = { exports: {} };
  const dependencies = { fs: { existsSync: p => files.has(p) }, path: win,
    child_process: {}, axios: {}, './messages': {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../server/leihu-launcher.js'), 'utf8'), {
    module, require: name => dependencies[name], __dirname: 'E:\\songRequest\\server',
    process: { platform: 'win32', env: {} },
  });
  files.add(win.join(root, 'python\\python.exe'));
  files.add(win.join(root, 'secure-runtime\\Scripts\\python.exe'));
  assert.equal(module.exports.findPython(root), win.join(root, 'python\\python.exe'));
  files.add(win.join(root, 'secure-runtime', 'leihu-ready.json'));
  assert.equal(module.exports.findPython(root), win.join(root, 'secure-runtime\\Scripts\\python.exe'));
});
