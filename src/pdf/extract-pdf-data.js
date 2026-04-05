const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function extractPdfData(pdfPath) {
  const buffer = fs.readFileSync(pdfPath);
  const binaryText = buffer.toString('latin1');
  const rawStrings = extractStrings(pdfPath);
  const visibleText = extractVisibleText(pdfPath);
  const payloads = extractTextPayloads(rawStrings.lines);
  const metadata = extractMetadata(binaryText);
  const hiddenBlocks = extractHiddenBlocks(payloads);
  const taggedFields = parseTaggedFields(hiddenBlocks.taggedFieldBlock?.payloads || []);
  const paramData = parseParamBlock(hiddenBlocks.paramBlock?.payloads || []);
  const folioData = parseFolioBlock(hiddenBlocks.folioBlock?.payloads || []);
  const folioDetailData = parseFolioDetailBlock(hiddenBlocks.folioDetailBlock?.payloads || []);
  const folioTransactionData = parseFolioTransactionBlock(
    hiddenBlocks.folioTransactionBlock?.payloads || []
  );
  const summary = buildSummary({
    pdfPath,
    metadata,
    taggedFields,
    paramData
  });

  return {
    pdfPath,
    metadata,
    rawStrings: rawStrings.text,
    visibleText,
    hiddenData: {
      taggedFields,
      paramData,
      folioData,
      folioDetailData,
      folioTransactionData,
      blocks: serializeBlocks(hiddenBlocks)
    },
    lineItems: buildLineItems({
      folioData,
      folioDetailData,
      folioTransactionData
    }),
    summary
  };
}

function extractVisibleText(pdfPath) {
  const scriptPath = resolveVisibleTextScriptPath();
  if (!fs.existsSync(scriptPath)) {
    return {
      fields: {},
      entries: [],
      fullText: '',
      pages: []
    };
  }

  try {
    const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'marriott-visible-text-'));
    const moduleCachePath = path.join(tempDirectory, 'swift-module-cache');
    fs.mkdirSync(moduleCachePath, { recursive: true });

    const output = execFileSync('swift', [scriptPath, pdfPath], {
      encoding: 'utf8',
      env: {
        ...process.env,
        SWIFT_MODULECACHE_PATH: moduleCachePath,
        CLANG_MODULE_CACHE_PATH: moduleCachePath
      },
      maxBuffer: 16 * 1024 * 1024
    });
    const parsed = JSON.parse(output);
    return normalizeVisibleText({
      fullText: parsed.fullText || '',
      pages: Array.isArray(parsed.pages) ? parsed.pages : []
    });
  } catch (_error) {
    return {
      fields: {},
      entries: [],
      fullText: '',
      pages: []
    };
  }
}

function extractStrings(pdfPath) {
  const output = execFileSync('/usr/bin/strings', ['-n', '4', pdfPath], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024
  });

  return {
    text: output,
    lines: output.split(/\r?\n/)
  };
}

function extractTextPayloads(lines) {
  return lines
    .map((line, index) => {
      const match = line.match(/^\((.*)\)\s*Tj$/);
      if (!match) {
        return null;
      }

      return {
        lineNumber: index + 1,
        value: match[1]
      };
    })
    .filter(Boolean);
}

function extractMetadata(binaryText) {
  return {
    creator: extractPdfMetadataValue(binaryText, 'Creator'),
    creationDate: extractPdfMetadataValue(binaryText, 'CreationDate'),
    modDate: extractPdfMetadataValue(binaryText, 'ModDate'),
    producer: extractPdfMetadataValue(binaryText, 'Producer'),
    title: extractPdfMetadataValue(binaryText, 'Title'),
    author: extractPdfMetadataValue(binaryText, 'Author')
  };
}

function extractPdfMetadataValue(binaryText, key) {
  const pattern = new RegExp(`\\/${key} \\(([^)]*)\\)`);
  const match = binaryText.match(pattern);
  return match ? match[1] : null;
}

function resolveVisibleTextScriptPath() {
  const candidates = [
    path.join(__dirname, 'extract-visible-text.swift')
  ];

  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, 'swift', 'extract-visible-text.swift'));
  }

  return candidates.find((candidate) => fs.existsSync(candidate))
    || path.join(__dirname, 'extract-visible-text.swift');
}

function normalizeVisibleText({ fullText, pages }) {
  const lines = buildVisibleLines(fullText);
  const { fields, entries } = parseVisibleFields(lines);

  return {
    fields,
    entries,
    fullText,
    pages
  };
}

function buildVisibleLines(fullText) {
  return String(fullText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseVisibleFields(lines) {
  const fields = {};
  const entries = [];
  const seenKeys = new Set();

  const fieldSpecs = [
    { key: 'guestName', labels: ['Guest Name', '姓名'] },
    { key: 'roomNumber', labels: ['Room No.', '房号'], inlinePattern: /^Room No\.\s*(.+)$/i },
    { key: 'address', labels: ['Address', '地址'] },
    { key: 'arrivalDate', labels: ['Arrival', '入住日期'] },
    { key: 'departureDate', labels: ['Departure', '离店日期'] },
    { key: 'loyaltyNumber', labels: ['Loyalty Number', '会员号码'] },
    { key: 'page', labels: ['Page', '页数'] },
    { key: 'confirmationNumber', labels: ['Confirmation No.', '确认号'], inlinePattern: /^Confirmation No\.\s*(.+)$/i },
    { key: 'folioNumber', labels: ['Folio No.', '账单号'], inlinePattern: /^Folio No\.\s*(.+)$/i },
    { key: 'balance', labels: ['Balance', '余额'], inlinePattern: /^Balance\s+(.+)$/i },
    {
      key: 'invoicePrintedAt',
      labels: ['INFORMATION INVOICE PRINTED ON'],
      inlinePattern: /^INFORMATION INVOICE PRINTED ON\s+(.+)$/i
    }
  ];

  const knownLabelSet = new Set(fieldSpecs.flatMap((spec) => spec.labels));

  for (const spec of fieldSpecs) {
    const value = readFieldValue(lines, spec, knownLabelSet, fieldSpecs);
    if (value !== null && value !== undefined && value !== '') {
      fields[spec.key] = value;
      entries.push({
        key: spec.key,
        label: spec.labels[0],
        value
      });
      seenKeys.add(spec.key);
    }
  }

  const hotelLine = lines.find((line) => line.startsWith('Thank you for staying at '));
  if (hotelLine && !seenKeys.has('hotelStatement')) {
    fields.hotelStatement = hotelLine;
    entries.push({
      key: 'hotelStatement',
      label: 'Thank you message',
      value: hotelLine
    });
  }

  const hotelNameLine = lines.find((line) => /Ritz-Carlton Reserve|Marriott|Rissai Valley/i.test(line));
  if (hotelNameLine && !seenKeys.has('hotelNameLine')) {
    fields.hotelNameLine = hotelNameLine;
    entries.push({
      key: 'hotelNameLine',
      label: 'Hotel name line',
      value: hotelNameLine
    });
  }

  return { fields, entries };
}

function readFieldValue(lines, spec, knownLabelSet, fieldSpecs) {
  if (spec.inlinePattern) {
    const inlineLine = lines.find((line) => spec.inlinePattern.test(line));
    if (inlineLine) {
      const match = inlineLine.match(spec.inlinePattern);
      const inlineValue = match?.[1]?.trim();
      if (inlineValue && !shouldSkipVisibleValueCandidate(inlineValue, knownLabelSet, fieldSpecs)) {
        return inlineValue;
      }
    }
  }

  const labelIndex = lines.findIndex((line) => spec.labels.includes(line));
  if (labelIndex === -1) {
    return null;
  }

  for (let index = labelIndex + 1; index < lines.length; index += 1) {
    const candidate = lines[index];
    if (!candidate || candidate === ':' || spec.labels.includes(candidate)) {
      continue;
    }

    if (knownLabelSet.has(candidate)) {
      break;
    }

    if (candidate === '：') {
      continue;
    }

    if (shouldSkipVisibleValueCandidate(candidate, knownLabelSet, fieldSpecs)) {
      continue;
    }

    return candidate;
  }

  return null;
}

function shouldSkipVisibleValueCandidate(candidate, knownLabelSet, fieldSpecs) {
  if (!candidate) {
    return true;
  }

  const trimmed = candidate.trim();
  if (!trimmed || trimmed === ':' || trimmed === '：') {
    return true;
  }

  if (knownLabelSet.has(trimmed)) {
    return true;
  }

  if (
    trimmed.startsWith('$Param') ||
    trimmed.startsWith('$Folio') ||
    trimmed.startsWith('~{[') ||
    trimmed.startsWith('~~{[') ||
    trimmed.startsWith('{"')
  ) {
    return true;
  }

  if (fieldSpecs.some((spec) => spec.inlinePattern && spec.inlinePattern.test(trimmed))) {
    return true;
  }

  return false;
}

function extractHiddenBlocks(payloads) {
  const blocks = {
    taggedFieldBlock: null,
    folioBlock: null,
    paramBlock: null,
    folioDetailBlock: null,
    folioTransactionBlock: null
  };

  for (let index = 0; index < payloads.length; index += 1) {
    const current = payloads[index].value;

    if (current.startsWith('~{[G#:')) {
      const result = collectUntil(payloads, index, (payload) => payload.value === ']}');
      blocks.taggedFieldBlock = result.block;
      index = result.endIndex;
      continue;
    }

    if (current.startsWith('~{[FOLIO:')) {
      const result = collectUntil(payloads, index, (payload) => payload.value === ']}');
      blocks.folioBlock = result.block;
      index = result.endIndex;
      continue;
    }

    if (current.startsWith('$Param={')) {
      const result = collectUntil(payloads, index, (payload) => payload.value.endsWith('}}$Param'));
      blocks.paramBlock = result.block;
      index = result.endIndex;
      continue;
    }

    if (current.startsWith('~~{[FOLIO:')) {
      const result = collectUntil(payloads, index, (payload) => payload.value === ']}');
      blocks.folioDetailBlock = result.block;
      index = result.endIndex;
      continue;
    }

    if (current.startsWith('~{[FOLIOTRXNO:')) {
      const result = collectUntil(payloads, index, (payload) => payload.value === ']}');
      blocks.folioTransactionBlock = result.block;
      index = result.endIndex;
    }
  }

  return blocks;
}

function collectUntil(payloads, startIndex, stopPredicate) {
  const collected = [];
  let endIndex = startIndex;

  for (let index = startIndex; index < payloads.length; index += 1) {
    collected.push(payloads[index]);
    endIndex = index;

    if (index !== startIndex && stopPredicate(payloads[index])) {
      break;
    }
  }

  return {
    endIndex,
    block: {
      startLine: payloads[startIndex].lineNumber,
      endLine: payloads[endIndex].lineNumber,
      payloads: collected
    }
  };
}

function parseTaggedFields(payloadEntries) {
  const fields = {};
  let currentKey = null;

  for (const entry of payloadEntries) {
    const token = entry.value;

    if (token === ']}') {
      currentKey = null;
      continue;
    }

    const normalized = token.replace(/^~+\{\[/, '');
    const matches = [...normalized.matchAll(/(?:^|\|)([A-Z#]+):([^|]*)/g)];

    if (matches.length > 0) {
      for (const match of matches) {
        const [, key, value] = match;
        if (value) {
          fields[key] = value;
          currentKey = null;
        } else {
          fields[key] = fields[key] || '';
          currentKey = key;
        }
      }
      continue;
    }

    if (currentKey) {
      fields[currentKey] = `${fields[currentKey]}${token}`;
    }
  }

  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, String(value || '').trim()])
  );
}

function parseParamBlock(payloadEntries) {
  const content = payloadEntries.map((entry) => entry.value).join('');

  if (!content) {
    return {
      raw: '',
      guestInfo: {}
    };
  }

  return {
    raw: content,
    guestInfo: {
      confirmationNo: extractJsonishValue(content, 'confirmationNo'),
      rmno: extractJsonishValue(content, 'rmno'),
      firstName: extractJsonishValue(content, 'firstName'),
      lastName: extractJsonishValue(content, 'lastName'),
      arrDate: extractJsonishValue(content, 'arrDate'),
      depDate: extractJsonishValue(content, 'depDate'),
      mobile: extractJsonishValue(content, 'mobile'),
      email: extractJsonishValue(content, 'email')
    }
  };
}

function extractJsonishValue(content, key) {
  const match = content.match(new RegExp(`"${key}":\\s*"([^"]*)"`));
  return match ? match[1] : null;
}

function parseFolioBlock(payloadEntries) {
  return parseDelimitedEntries(payloadEntries, /^~\{\[FOLIO:/, (parts) => ({
    chargeCode: parts[0] || null,
    amount: toNumber(parts[1])
  }));
}

function parseFolioDetailBlock(payloadEntries) {
  return parseDelimitedEntries(payloadEntries, /^~~\{\[FOLIO:/, (parts) => ({
    transactionNumber: parts[0] || null,
    chargeCode: parts[1] || null,
    amount: toNumber(parts[2])
  }));
}

function parseFolioTransactionBlock(payloadEntries) {
  return parseDelimitedEntries(payloadEntries, /^~\{\[FOLIOTRXNO:/, (parts) => ({
    chargeCode: parts[0] || null,
    amount: toNumber(parts[1]),
    transactionNumber: parts[2] || null
  }));
}

function parseDelimitedEntries(payloadEntries, markerPattern, mapper) {
  const raw = payloadEntries.map((entry) => entry.value).join('');
  const normalized = raw
    .replace(markerPattern, '')
    .replace(/\]\}$/g, '')
    .trim();

  if (!normalized) {
    return {
      raw,
      entries: []
    };
  }

  const entries = normalized
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => mapper(segment.split('|')));

  return {
    raw,
    entries
  };
}

function buildSummary({ pdfPath, metadata, taggedFields, paramData }) {
  const guestFirstName = firstNonEmpty(
    taggedFields.GF,
    paramData.guestInfo.firstName
  );
  const guestLastName = firstNonEmpty(
    taggedFields.GN,
    paramData.guestInfo.lastName
  );
  const email = firstNonEmpty(
    taggedFields.EMAIL,
    taggedFields.EM,
    paramData.guestInfo.email
  );
  const phone = firstNonEmpty(
    taggedFields.MOBILE,
    taggedFields.PH,
    paramData.guestInfo.mobile
  );
  const checkInDate = firstNonEmpty(
    taggedFields.GA,
    normalizeDate(paramData.guestInfo.arrDate)
  );
  const checkOutDate = firstNonEmpty(
    taggedFields.GD,
    normalizeDate(paramData.guestInfo.depDate)
  );
  const roomNumber = firstNonEmpty(
    paramData.guestInfo.rmno,
    taggedFields.RN
  );
  const confirmationNumber = firstNonEmpty(
    paramData.guestInfo.confirmationNo,
    taggedFields.RC,
    taggedFields['R#']
  );

  return {
    sourcePdfName: path.basename(pdfPath),
    guest: {
      firstName: guestFirstName || 'Unknown',
      lastName: guestLastName || 'Guest',
      fullName: [guestFirstName, guestLastName].filter(Boolean).join(' ').trim() || 'Unknown Guest'
    },
    stay: {
      hotelCode: taggedFields.HC || null,
      roomNumber: roomNumber || null,
      confirmationNumber: confirmationNumber || null,
      checkInDate: checkInDate || null,
      checkOutDate: checkOutDate || null,
      status: taggedFields.RS || null,
      balanceAmount: taggedFields.AMT || null
    },
    contact: {
      email: email || null,
      phone: phone || null
    },
    identifiers: {
      uid: taggedFields.UID || null,
      guestNumber: taggedFields['G#'] || null,
      reservationNumber: taggedFields['R#'] || null,
      profileNumber: taggedFields['P#'] || null
    },
    pdfMetadata: metadata
  };
}

function buildLineItems({ folioData, folioDetailData, folioTransactionData }) {
  const rows = [];

  for (const entry of folioData.entries) {
    rows.push({
      source: 'folio-summary',
      chargeCode: entry.chargeCode,
      amount: entry.amount,
      transactionNumber: null
    });
  }

  for (const entry of folioDetailData.entries) {
    rows.push({
      source: 'folio-detail',
      chargeCode: entry.chargeCode,
      amount: entry.amount,
      transactionNumber: entry.transactionNumber
    });
  }

  for (const entry of folioTransactionData.entries) {
    rows.push({
      source: 'folio-transaction',
      chargeCode: entry.chargeCode,
      amount: entry.amount,
      transactionNumber: entry.transactionNumber
    });
  }

  return rows;
}

function serializeBlocks(blocks) {
  return Object.fromEntries(
    Object.entries(blocks).map(([key, value]) => [
      key,
      value
        ? {
            startLine: value.startLine,
            endLine: value.endLine,
            payloads: value.payloads.map((entry) => ({
              lineNumber: entry.lineNumber,
              value: entry.value
            }))
          }
        : null
    ])
  );
}

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (!match) {
    return value;
  }

  const [, day, month, year] = match;
  return `20${year}-${month}-${day}`;
}

function firstNonEmpty(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== '');
}

function toNumber(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

module.exports = {
  extractPdfData
};
