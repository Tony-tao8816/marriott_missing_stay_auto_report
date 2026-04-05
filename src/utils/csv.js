function stringifyCsv(rows) {
  if (!rows || rows.length === 0) {
    return '';
  }

  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const lines = [
    headers.map(escapeCsvValue).join(',')
  ];

  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsvValue(row[header])).join(','));
  }

  return `${lines.join('\n')}\n`;
}

function escapeCsvValue(value) {
  if (value === undefined || value === null) {
    return '';
  }

  const text = String(value);
  if (!/[",\n]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

module.exports = {
  stringifyCsv
};

