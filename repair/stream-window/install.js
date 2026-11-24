'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const BROKEN = 'res.json(streamWindow.open(`http://localhost:${listeningPort}/dashboard?window=stream${lang}${tab}`));';
const FIXED = 'res.json(streamWindow.open(`http://localhost:${server.address().port}/dashboard?window=stream${lang}${tab}`));';
const occurrences = (data, needle) => data.toString('utf8').split(needle).length - 1;

function isProject(folder) {
  return fs.existsSync(path.join(folder, 'package.json')) &&
    fs.existsSync(path.join(folder, 'server', 'index.js')) &&
    fs.existsSync(path.join(folder, 'server', 'stream-window.js'));
}

function install(project = process.cwd()) {
  const root = path.resolve(project);
  if (!isProject(root)) throw Error('Choose the song-request project folder containing package.json and server/index.js.');
  const target = path.join(root, 'server', 'index.js');
  const original = fs.readFileSync(target);
  const broken = occurrences(original, BROKEN), fixed = occurrences(original, FIXED);
  if (broken === 0 && fixed === 1) return { target, unchanged: true };
  if (broken !== 1 || fixed !== 0) {
    throw Error('The known stream-window bug was not found exactly once. Nothing was changed; merge the fix manually.');
  }
  const index = original.indexOf(Buffer.from(BROKEN));
  const updated = Buffer.concat([original.subarray(0, index), Buffer.from(FIXED),
    original.subarray(index + Buffer.byteLength(BROKEN))]);
  new vm.Script(updated.toString('utf8'), { filename: target });
  const suffix = `${Date.now()}-${process.pid}-${crypto.randomBytes(3).toString('hex')}`;
  const backup = `${target}.before-window-fix-${suffix}.bak`;
  const temporary = `${target}.window-fix-${suffix}.tmp`;
  fs.writeFileSync(backup, original, { flag: 'wx', mode: fs.statSync(target).mode });
  try {
    fs.writeFileSync(temporary, updated, { flag: 'wx', mode: fs.statSync(target).mode });
    if (!fs.readFileSync(target).equals(original)) throw Error('The project changed during repair; stopped without overwriting it.');
    fs.renameSync(temporary, target);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
  return { target, backup, unchanged: false };
}

module.exports = { install, BROKEN, FIXED };

if (require.main === module) {
  (async () => {
    let project = process.argv[2];
    if (!project) project = [process.cwd(), __dirname, path.dirname(__dirname)].find(isProject);
    if (!project && process.stdin.isTTY) {
      const readline = require('node:readline/promises');
      const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
      try { project = (await prompt.question('Song-request project folder (the one containing package.json): ')).trim(); }
      finally { prompt.close(); }
    }
    if (!project) throw Error('Run: node install.js "PATH-TO-SONG-REQUEST-PROJECT"');
    project = project.replace(/^"(.*)"$/, '$1');
    const result = install(project);
    console.log(result.unchanged ? 'Already repaired; no changes needed.' : 'Stream-window startup repaired.');
    console.log(`Project file: ${result.target}`);
    if (result.backup) console.log(`Backup: ${result.backup}`);
    console.log('Start the app with start_zh.bat or start.bat.');
  })().catch(error => { console.error(`Repair stopped: ${error.message}`); process.exitCode = 1; });
}
