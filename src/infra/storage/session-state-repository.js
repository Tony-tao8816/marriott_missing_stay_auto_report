const fs = require('node:fs');
const path = require('node:path');
const { ensureDir } = require('../../shared/paths');

async function ensureSessionStateDir(sessionStatePath) {
  await ensureDir(path.dirname(path.resolve(sessionStatePath)));
}

function resolveSessionStatePath(sessionStatePath) {
  return path.resolve(sessionStatePath);
}

function hasSessionState(sessionStatePath) {
  return fs.existsSync(resolveSessionStatePath(sessionStatePath));
}

module.exports = {
  ensureSessionStateDir,
  hasSessionState,
  resolveSessionStatePath
};
