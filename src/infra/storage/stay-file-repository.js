const fs = require('node:fs/promises');
const path = require('node:path');
const { parse } = require('csv-parse/sync');
const { stayRecordSchema } = require('../../domain/schemas');

async function loadStayRecords(inputPath) {
  const rawRecords = await loadRawRecords(inputPath);

  return rawRecords.map((record, index) => normalizeStayRecord(record, inputPath, index));
}

async function loadRawRecords(inputPath) {
  const extension = path.extname(inputPath).toLowerCase();
  const content = await fs.readFile(inputPath, 'utf8');

  if (extension === '.json') {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) {
      throw new Error('JSON input must be an array of stay records.');
    }
    return parsed;
  }

  if (extension === '.csv') {
    return parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
  }

  throw new Error(`Unsupported input extension: ${extension}. Use .json or .csv.`);
}

function normalizeStayRecord(record, inputPath, index) {
  const sanitized = Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, normalizeString(value)])
  );

  const parsed = stayRecordSchema.parse(sanitized);
  return {
    ...parsed,
    id: parsed.id || `${parsed.confirmationNumber}-${index + 1}`,
    attachmentPath: parsed.attachmentPath
      ? resolveAttachmentPath(parsed.attachmentPath, inputPath)
      : undefined
  };
}

function normalizeString(value) {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function resolveAttachmentPath(attachmentPath, inputPath) {
  if (path.isAbsolute(attachmentPath)) {
    return attachmentPath;
  }

  return path.resolve(path.dirname(inputPath), attachmentPath);
}

module.exports = {
  loadStayRecords
};
