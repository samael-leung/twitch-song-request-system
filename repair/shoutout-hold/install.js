'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const supported = 'cc393bf4a4ca7080d33ecb438aeb31a80165a3c75653326cec75976269de467f';
const normalize = bytes => bytes.toString('utf8').replace(/\r\n/g, '\n');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

function install(project = process.cwd()) {
  const target = path.resolve(project, 'server', 'modes.js');
  const payload = fs.existsSync(path.join(__dirname, 'modes.js'))
    ? path.join(__dirname, 'modes.js') : path.resolve(__dirname, '../../server/modes.js');
  const original = fs.readFileSync(target);
  const fixed = normalize(fs.readFileSync(payload));
  if (!fixed.includes('if (data.active === mode.id) mediaQueue.setHold(mode.holdClips);')) {
    throw Error('Repair payload is missing the active-mode fix; nothing was changed.');
  }
  if (hash(normalize(original)) === hash(fixed)) return { target, unchanged: true };
  if (hash(normalize(original)) !== supported) {
    throw Error('Unrecognized/customized server/modes.js; nothing was changed. Keep this file and merge the fix instead.');
  }
  const suffix = `${Date.now()}-${process.pid}`;
  const backup = `${target}.before-so-fix-${suffix}.bak`;
  const temporary = `${target}.so-fix-${suffix}.tmp`;
  fs.writeFileSync(backup, original, { flag: 'wx' });
  try {
    const text = original.includes(Buffer.from('\r\n')) ? fixed.replace(/\n/g, '\r\n') : fixed;
    fs.writeFileSync(temporary, text, { flag: 'wx' });
    fs.renameSync(temporary, target);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
  return { target, backup, unchanged: false };
}

if (require.main === module) {
  try {
    const result = install(process.argv[2]);
    console.log(result.unchanged ? 'Already fixed.' : `Updated: ${result.target}\nBackup: ${result.backup}`);
    console.log('Restart npm start. In Modes, turn off Hold clips on the active mode to play queued !so clips.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = { install };
