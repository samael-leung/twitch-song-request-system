const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawnSync } = require('node:child_process');
const { install, BROKEN, FIXED } = require('../repair/stream-window/install');

function project(t, body) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'window repair '));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'server'));
  fs.writeFileSync(path.join(root, 'package.json'), '{}');
  fs.writeFileSync(path.join(root, 'server/stream-window.js'), '// existing browser helper');
  fs.writeFileSync(path.join(root, 'server/index.js'), body);
  fs.writeFileSync(path.join(root, '.env'), 'PRIVATE=fixture-secret\n');
  return { root, target: path.join(root, 'server/index.js') };
}
const source = `// 自訂功能保留\nfunction customFeature() { return 'keep'; }\nfunction route() { ${BROKEN} }\n`;

test('repair preserves LF/CRLF, BOM, local customizations, exact backup bytes and idempotency', t => {
  for (const text of [source, '\ufeff' + source.replaceAll('\n', '\r\n')]) {
    const p = project(t, text), original = fs.readFileSync(p.target);
    const result = install(p.root);
    assert.deepEqual(fs.readFileSync(result.backup), original);
    assert.equal(fs.readFileSync(p.target, 'utf8'), text.replace(BROKEN, FIXED));
    assert.equal(fs.readFileSync(path.join(p.root, '.env'), 'utf8'), 'PRIVATE=fixture-secret\n');
    const files = fs.readdirSync(path.dirname(p.target));
    assert.equal(install(p.root).unchanged, true);
    assert.deepEqual(fs.readdirSync(path.dirname(p.target)), files);
  }
});

test('unknown, duplicate and invalid JavaScript versions are refused without changing anything', t => {
  for (const text of [source.replace(BROKEN, 'customLaunch();'), source + `function other(){${BROKEN}}`, source + '\nfunction {']) {
    const p = project(t, text), before = fs.readFileSync(p.target);
    assert.throws(() => install(p.root));
    assert.deepEqual(fs.readFileSync(p.target), before);
    assert.deepEqual(fs.readdirSync(path.dirname(p.target)).sort(), ['index.js', 'stream-window.js']);
  }
});

test('repair CLI handles a project path with spaces without requiring Git or external services', t => {
  const p = project(t, source);
  const result = spawnSync(process.execPath, [path.resolve(__dirname, '../repair/stream-window/install.js'), p.root], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes('Stream-window startup repaired'));
  assert.ok(fs.readFileSync(p.target, 'utf8').includes(FIXED));
});

test('repair is idempotent against the current complete server without erasing its diagnostics', t => {
  const current = fs.readFileSync(path.join(__dirname, '../server/index.js'));
  const p = project(t, current);
  assert.equal(install(p.root).unchanged, true);
  assert.deepEqual(fs.readFileSync(p.target), current);
});
