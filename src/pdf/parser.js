const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

const HEADER_FIELDS = {
  guest_name: [130, 112, 260, 126],
  room_no: [480, 112, 540, 126],
  arrival_date: [480, 125, 540, 140],
  departure_date: [480, 139, 540, 154],
  loyalty_number: [130, 154, 260, 168],
  company: [130, 168, 260, 182],
  confirmation_no: [480, 167, 545, 181],
  folio_no: [480, 181, 525, 195],
  ar_no: [130, 182, 260, 196],
  cashier: [480, 195, 555, 210]
};

const TABLE_Y_MIN = 270;
const TABLE_Y_MAX = 402;
const ROW_Y_TOLERANCE = 3.0;
const TOTAL_CHARGES_RECT = [445, 408, 495, 422];
const TOTAL_CREDITS_RECT = [530, 408, 580, 422];

/**
 * 解析万豪酒店 PDF 账单
 * @param {string} pdfPath - PDF 文件路径
 * @returns {Promise<Object>} 提取的账单信息
 */
async function parseMarriottPDF(pdfPath) {
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF 文件不存在: ${pdfPath}`);
  }

  const dataBuffer = fs.readFileSync(pdfPath);
  const { pdfData, pages } = await extractPdfPages(dataBuffer);

  if (pages.length === 0) {
    throw new Error(`PDF 未提取到任何页面: ${pdfPath}`);
  }

  const rawText = pages.map((page) => page.rawText).join('\n\n');
  const linearText = pages.map((page) => page.linearText).join('\n\n');
  const lines = rawText.split('\n').map((line) => line.trim()).filter(Boolean);
  const extractedInfo = extractInfoFromLines(lines, rawText, {
    pdfPath,
    pages,
    linearText,
    pageCount: pdfData.numpages
  });

  return {
    rawText,
    lines,
    extractedInfo,
    metadata: {
      pageCount: pdfData.numpages,
      fileName: path.basename(pdfPath),
      parsedAt: new Date().toISOString()
    }
  };
}

/**
 * 兼容旧调用方式，同时支持传入坐标解析上下文。
 */
function extractInfoFromLines(lines, fullText, context = {}) {
  const pages = Array.isArray(context.pages) ? context.pages : [];
  const firstPage = pages[0] || { words: [], rawText: fullText || '' };
  const lastPage = pages[pages.length - 1] || firstPage;
  const linearText = context.linearText || fullText || '';
  const headerFields = extractHeaderFields(firstPage.words || []);
  const metadataBlock = parseMetadataBlock(linearText) || parseMetadataBlock(fullText || '');
  const headerGuestName = headerFields.guest_name || buildGuestNameFromMetadata(metadataBlock);
  const [guestName, guestNameEn, guestNameCn] = splitGuestName(headerGuestName);
  const lineItems = parseLineItems(pages);
  const totals = extractTotals(lastPage.words || [], linearText || fullText || '');
  const balanceInfo = extractBalance(linearText || fullText || '');

  const hotelName =
    firstNonEmptyLine(firstPage.rawText || '') ||
    extractHotelName(fullText || '') ||
    null;
  const hotelAddress =
    nthNonEmptyLine(firstPage.rawText || '', 1) ||
    extractHotelAddress(fullText || '') ||
    null;
  const hotelPhone = extractHotelPhone(fullText || linearText || '') || null;
  const hotelWebsite = extractHotelWebsite(fullText || linearText || '') || null;
  const roomNumber = noneIfEmpty(headerFields.room_no || metadataBlock.RN);
  const loyaltyNumber = noneIfEmpty(headerFields.loyalty_number || metadataBlock.UID);
  const company = noneIfEmpty(headerFields.company);
  const confirmationNumber = noneIfEmpty(headerFields.confirmation_no);
  const folioNumber = noneIfEmpty(headerFields.folio_no);
  const arNumber = noneIfEmpty(headerFields.ar_no);
  const cashier = noneIfEmpty(headerFields.cashier);
  const arrivalDate =
    parseShortDate(headerFields.arrival_date) ||
    parseDateLike(metadataBlock.GA) ||
    null;
  const departureDate =
    parseShortDate(headerFields.departure_date) ||
    parseDateLike(metadataBlock.GD) ||
    null;
  const printedAt = parsePrintedAt(linearText || fullText || '');
  const charges = lineItems
    .filter((item) => item.chargeAmount !== null)
    .map((item) => ({
      date: item.serviceDate,
      description: item.description,
      amount: item.chargeAmount
    }));
  const payments = lineItems
    .filter((item) => item.creditAmount !== null)
    .map((item) => ({
      date: item.serviceDate,
      type: item.description,
      amount: item.creditAmount
    }));

  return {
    templateName: 'opera_guest_folio',
    hotelName,
    hotelAddress,
    hotelPhone,
    hotelWebsite,
    guestName,
    guestNameEn,
    guestNameCn,
    roomNumber,
    roomNo: roomNumber,
    company,
    loyaltyNumber,
    arNumber,
    arNo: arNumber,
    confirmationNumber,
    confirmationNo: confirmationNumber,
    folioNumber,
    folioNo: folioNumber,
    cashier,
    guestPhone: noneIfEmpty(metadataBlock.PH || metadataBlock.MOBILE),
    guestEmail: noneIfEmpty(metadataBlock.EM || metadataBlock.EMAIL),
    arrivalDate,
    departureDate,
    invoicePrintedDate: printedAt,
    printedAt,
    totalCharges: totals.charges,
    totalCredits: totals.credits,
    balance: balanceInfo.balance,
    currency: balanceInfo.currency,
    charges,
    payments,
    lineItems,
    metadataBlock
  };
}

async function extractPdfPages(dataBuffer) {
  const pages = [];
  let currentPageNumber = 0;

  const pdfData = await pdfParse(dataBuffer, {
    pagerender: async (pageData) => {
      currentPageNumber += 1;
      const page = await renderPage(pageData, currentPageNumber);
      pages.push(page);
      return page.rawText;
    }
  });

  return { pdfData, pages };
}

async function renderPage(pageData, pageNumber) {
  const viewport = pageData.getViewport(1.0);
  const textContent = await pageData.getTextContent({
    normalizeWhitespace: false,
    disableCombineTextItems: true
  });
  const words = [];

  for (const item of textContent.items) {
    words.push(...textItemToWords(item, viewport.height, pageNumber));
  }

  return {
    number: pageNumber,
    rawText: buildPageRawText(words),
    linearText: buildLinearText(textContent.items),
    words
  };
}

function textItemToWords(item, pageHeight, pageNumber) {
  const text = typeof item.str === 'string' ? item.str : '';

  if (!text.trim()) {
    return [];
  }

  const height = Math.abs(item.height || item.transform?.[3] || 0);
  const x0 = item.transform?.[4] || 0;
  const baselineY = item.transform?.[5] || 0;
  const y0 = pageHeight - baselineY;
  const y1 = y0 + height;
  const width = Math.abs(item.width || 0);
  const matches = Array.from(text.matchAll(/\S+/g));

  if (matches.length === 0 || width === 0 || text.length === 0) {
    return [{
      x0,
      y0,
      x1: x0 + width,
      y1,
      text: text.trim(),
      pageNumber
    }];
  }

  return matches.map((match) => {
    const start = match.index || 0;
    const end = start + match[0].length;
    return {
      x0: x0 + (width * start) / text.length,
      y0,
      x1: x0 + (width * end) / text.length,
      y1,
      text: match[0],
      pageNumber
    };
  });
}

function buildPageRawText(words) {
  return groupWordsByRow(words, 2.0)
    .map((row) => joinWords(row))
    .filter(Boolean)
    .join('\n');
}

function buildLinearText(items) {
  let text = '';
  let lastY = null;
  let lastX1 = null;

  for (const item of items) {
    const value = typeof item.str === 'string' ? item.str : '';

    if (!value) {
      continue;
    }

    const currentY = item.transform?.[5] || 0;
    const currentX0 = item.transform?.[4] || 0;
    const currentX1 = currentX0 + Math.abs(item.width || 0);

    if (lastY !== null && Math.abs(currentY - lastY) > 0.5) {
      text += '\n';
    } else if (lastX1 !== null && currentX0 - lastX1 > 1.5) {
      text += ' ';
    }
    text += value;
    lastY = currentY;
    lastX1 = currentX1;
  }

  return text;
}

function extractHeaderFields(words) {
  return Object.fromEntries(
    Object.entries(HEADER_FIELDS).map(([name, rect]) => [name, extractTextFromRect(words, rect)])
  );
}

function extractTextFromRect(words, rect) {
  const [x0, y0, x1, y1] = rect;
  return joinWords(
    words.filter((word) => {
      const centerX = (word.x0 + word.x1) / 2;
      const centerY = (word.y0 + word.y1) / 2;
      return centerX >= x0 && centerX <= x1 && centerY >= y0 && centerY <= y1;
    })
  );
}

function parseMetadataBlock(text) {
  const match = text.match(/~\{\[([\s\S]*?)\]\}/);
  if (!match) {
    return {};
  }

  return match[1].split('|').reduce((result, part) => {
    const separatorIndex = part.indexOf(':');
    if (separatorIndex === -1) {
      return result;
    }

    const key = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    if (key) {
      result[key] = value;
    }
    return result;
  }, {});
}

function buildGuestNameFromMetadata(metadataBlock) {
  const lastName = noneIfEmpty(metadataBlock.GN);
  const firstName = noneIfEmpty(metadataBlock.GF);

  if (!lastName && !firstName) {
    return null;
  }

  return [lastName, firstName].filter(Boolean).join(', ');
}

function splitGuestName(value) {
  const cleaned = noneIfEmpty(value);
  if (!cleaned) {
    return [null, null, null];
  }

  const chineseParts = cleaned.match(/[\u4e00-\u9fff]+/g) || [];
  const guestNameCn = chineseParts.length > 0 ? chineseParts.join('') : null;
  const guestNameEn = noneIfEmpty(cleaned.replace(/[\u4e00-\u9fff]+/g, ''));

  return [cleaned, guestNameEn, guestNameCn];
}

function parseLineItems(pages) {
  const items = [];
  let sortOrder = 1;

  for (const page of pages) {
    const tableWords = page.words.filter((word) => {
      const centerX = (word.x0 + word.x1) / 2;
      const centerY = (word.y0 + word.y1) / 2;
      return centerY >= TABLE_Y_MIN && centerY <= TABLE_Y_MAX && centerX <= 580;
    });

    for (const row of groupWordsByRow(tableWords, ROW_Y_TOLERANCE)) {
      const dateText = joinWords(row.filter((word) => word.x0 < 60));
      const description = joinWords(row.filter((word) => word.x0 >= 75 && word.x0 < 430));
      const chargeText = joinWords(row.filter((word) => word.x0 >= 430 && word.x0 < 520));
      const creditText = joinWords(row.filter((word) => word.x0 >= 520));

      if (!dateText && !description && !chargeText && !creditText) {
        continue;
      }

      if (!dateText && description && !chargeText && !creditText) {
        const lastItem = items[items.length - 1];
        if (lastItem) {
          lastItem.description = `${lastItem.description} ${description}`.trim();
        }
        continue;
      }

      if (!dateText) {
        continue;
      }

      items.push({
        sortOrder,
        serviceDate: parseShortDate(dateText),
        description: noneIfEmpty(description),
        chargeAmount: parseAmount(chargeText),
        creditAmount: parseAmount(creditText),
        pageNumber: page.number
      });
      sortOrder += 1;
    }
  }

  return items;
}

function extractTotals(words, combinedText) {
  let charges = parseAmount(extractTextFromRect(words, TOTAL_CHARGES_RECT));
  let credits = parseAmount(extractTextFromRect(words, TOTAL_CREDITS_RECT));

  if (!charges || !credits) {
    const flattened = combinedText.replace(/\s+/g, ' ');
    const match = flattened.match(/Total\s+([0-9,.-]+)\s+([0-9,.-]+)/i);
    if (match) {
      charges = charges || parseAmount(match[1]);
      credits = credits || parseAmount(match[2]);
    }
  }

  return { charges, credits };
}

function extractBalance(text) {
  const flattened = text.replace(/\s+/g, ' ');
  const match = flattened.match(/Balance\s+([A-Z]{3})?([0-9,.-]+)/i);

  if (!match) {
    return { balance: null, currency: null };
  }

  return {
    balance: parseAmount(match[2]),
    currency: match[1] || 'CNY'
  };
}

function groupWordsByRow(words, yTolerance = ROW_Y_TOLERANCE) {
  const ordered = [...words].sort((left, right) => {
    if (left.y0 !== right.y0) {
      return left.y0 - right.y0;
    }
    return left.x0 - right.x0;
  });
  const rows = [];
  let currentRow = [];
  let currentY = null;

  for (const word of ordered) {
    if (currentY === null || Math.abs(word.y0 - currentY) <= yTolerance) {
      currentRow.push(word);
      currentY = currentY === null ? word.y0 : (currentY + word.y0) / 2;
      continue;
    }

    rows.push(currentRow.sort((left, right) => left.x0 - right.x0));
    currentRow = [word];
    currentY = word.y0;
  }

  if (currentRow.length > 0) {
    rows.push(currentRow.sort((left, right) => left.x0 - right.x0));
  }

  return rows;
}

function joinWords(words) {
  return noneIfEmpty(
    [...words]
      .sort((left, right) => {
        if (left.y0 !== right.y0) {
          return left.y0 - right.y0;
        }
        return left.x0 - right.x0;
      })
      .map((word) => word.text)
      .join(' ')
  ) || '';
}

function parseShortDate(value) {
  const match = noneIfEmpty(value)?.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const fullYear = year < 50 ? 2000 + year : 1900 + year;

  if (!isValidDateParts(fullYear, month, day)) {
    return null;
  }

  return `${String(fullYear).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseDateLike(value) {
  const cleaned = noneIfEmpty(value);
  if (!cleaned) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }

  return parseShortDate(cleaned);
}

function parsePrintedAt(text) {
  const match = text.match(/PRINTED ON\s+([0-9]{2}-[A-Z]{3}-[0-9]{2}\s+[0-9]{2}:[0-9]{2})/i);
  if (!match) {
    return null;
  }

  const monthMap = {
    JAN: '01',
    FEB: '02',
    MAR: '03',
    APR: '04',
    MAY: '05',
    JUN: '06',
    JUL: '07',
    AUG: '08',
    SEP: '09',
    OCT: '10',
    NOV: '11',
    DEC: '12'
  };
  const normalized = match[1].toUpperCase().match(/^(\d{2})-([A-Z]{3})-(\d{2})\s+(\d{2}):(\d{2})$/);
  if (!normalized) {
    return null;
  }

  const day = normalized[1];
  const month = monthMap[normalized[2]];
  const year = Number(normalized[3]) < 50 ? `20${normalized[3]}` : `19${normalized[3]}`;

  if (!month) {
    return null;
  }

  return `${year}-${month}-${day}T${normalized[4]}:${normalized[5]}`;
}

function parseAmount(value) {
  const cleaned = noneIfEmpty(value);
  if (!cleaned) {
    return null;
  }

  const normalized = cleaned.replace(/,/g, '');
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    return null;
  }

  return normalized;
}

function extractHotelName(text) {
  return firstNonEmptyLine(text);
}

function extractHotelAddress(text) {
  return nthNonEmptyLine(text, 1);
}

function extractHotelPhone(text) {
  const match = text.match(/T:\s*([+\d][\d\s-]*)/i);
  return match ? noneIfEmpty(match[1]) : null;
}

function extractHotelWebsite(text) {
  const match = text.match(/\britzcarlton\.com\b/i);
  return match ? match[0] : null;
}

function firstNonEmptyLine(text) {
  return nthNonEmptyLine(text, 0);
}

function nthNonEmptyLine(text, index) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  return index < lines.length ? lines[index] : null;
}

function isValidDateParts(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function noneIfEmpty(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const cleaned = String(value).replace(/\s+/g, ' ').trim();
  return cleaned || null;
}

module.exports = {
  parseMarriottPDF,
  extractInfoFromLines
};
