const fs = require('node:fs/promises');
const path = require('node:path');

function timestampForFile(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function sanitizeFileSegment(value) {
  return String(value).replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-+|-+$/g, '');
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
  return dirPath;
}

function resolveUrl(baseUrl, target) {
  return new URL(target, baseUrl).toString();
}

function artifactFile(baseDir, fileName) {
  return path.join(baseDir, fileName);
}

module.exports = {
  artifactFile,
  ensureDir,
  resolveUrl,
  sanitizeFileSegment,
  timestampForFile
};
