const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function sanitizePdf({ sourcePdfPath, destinationPdfPath, extraction }) {
  const buffer = fs.readFileSync(sourcePdfPath);
  let text = buffer.toString('latin1');

  const metadataKeys = ['Creator', 'CreationDate', 'ModDate', 'Producer', 'Title', 'Author'];
  for (const key of metadataKeys) {
    text = redactPdfMetadataValue(text, key);
  }

  const sensitivePayloads = collectSensitivePayloads(extraction);
  for (const payload of sensitivePayloads) {
    text = redactLiteralStringPayload(text, payload);
  }

  text = redactExactValue(text, 'HWANG154');

  fs.writeFileSync(destinationPdfPath, Buffer.from(text, 'latin1'));
  applyVisibleTextRedaction({
    pdfPath: destinationPdfPath,
    extraction
  });
}

function collectSensitivePayloads(extraction) {
  const payloads = new Set();
  const blocks = extraction.hiddenData.blocks;

  for (const block of Object.values(blocks)) {
    if (!block) {
      continue;
    }

    for (const entry of block.payloads) {
      payloads.add(entry.value);
    }
  }

  return [...payloads].filter(Boolean);
}

function redactPdfMetadataValue(text, key) {
  const pattern = new RegExp(`(\\/${key} \\()([^)]*)(\\))`, 'g');
  return text.replace(pattern, (_match, prefix, value, suffix) => {
    return `${prefix}${' '.repeat(value.length)}${suffix}`;
  });
}

function redactLiteralStringPayload(text, payload) {
  const escapedPayload = escapeRegExp(payload);
  const pattern = new RegExp(`(\\()${escapedPayload}(\\)\\s*Tj)`, 'g');
  return text.replace(pattern, (_match, prefix, suffix) => {
    return `${prefix}${' '.repeat(payload.length)}${suffix}`;
  });
}

function redactExactValue(text, value) {
  const pattern = new RegExp(escapeRegExp(value), 'g');
  return text.replace(pattern, ' '.repeat(value.length));
}

function applyVisibleTextRedaction({ pdfPath, extraction }) {
  const scriptPath = resolveSwiftScriptPath();
  if (!fs.existsSync(scriptPath)) {
    return;
  }

  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'marriott-folio-redact-'));
  const configPath = path.join(tempDirectory, 'config.json');
  const destinationPath = path.join(tempDirectory, 'redacted.pdf');
  const moduleCachePath = path.join(tempDirectory, 'swift-module-cache');
  fs.mkdirSync(moduleCachePath, { recursive: true });

  const config = {
    sourcePdfPath: pdfPath,
    destinationPdfPath: destinationPath,
    exactTexts: buildVisibleExactTexts(extraction),
    lineContains: ['$Folio=', '$Param=', '~{[FOLIO', '~{[FOLIOTRXNO'],
    minPipeCountForLineRedaction: 3
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  execFileSync('swift', [scriptPath, configPath], {
    encoding: 'utf8',
    env: {
      ...process.env,
      SWIFT_MODULECACHE_PATH: moduleCachePath,
      CLANG_MODULE_CACHE_PATH: moduleCachePath
    },
    maxBuffer: 16 * 1024 * 1024
  });

  fs.copyFileSync(destinationPath, pdfPath);
}

function resolveSwiftScriptPath() {
  const candidates = [];

  if (__dirname) {
    candidates.push(path.join(__dirname, 'sanitize-visible-text.swift'));

    if (__dirname.includes('app.asar')) {
      candidates.push(
        path.join(
          __dirname.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`),
          'sanitize-visible-text.swift'
        )
      );
    }
  }

  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, 'swift', 'sanitize-visible-text.swift'));
    candidates.push(
      path.join(process.resourcesPath, 'app.asar.unpacked', 'src', 'pdf', 'sanitize-visible-text.swift')
    );
  }

  return candidates.find((candidate) => candidate && fs.existsSync(candidate))
    || path.join(__dirname, 'sanitize-visible-text.swift');
}

function buildVisibleExactTexts(extraction) {
  return [
    extraction.summary.identifiers.uid
  ].filter(Boolean);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  sanitizePdf
};
