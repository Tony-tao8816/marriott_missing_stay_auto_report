const fs = require('node:fs/promises');
const path = require('node:path');
const { parse } = require('csv-parse/sync');
const { stayRecordSchema } = require('../config/schema');

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

async function loadStayRecords(inputPath) {
  const rawRecords = await loadRawRecords(inputPath);

  return rawRecords.map((record, index) => {
    const parsed = stayRecordSchema.parse(record);
    return {
      ...parsed,
      id: parsed.id || `${parsed.confirmationNumber}-${index + 1}`
    };
  });
}

module.exports = {
  loadStayRecords
};
