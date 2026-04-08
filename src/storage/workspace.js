const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { stringifyCsv } = require('../utils/csv');

async function createWorkspace({ extraction, sourcePdfPath, outputRoot }) {
  const root = outputRoot || path.join(os.homedir(), 'Documents', 'marriott_missing_stay_auto_report');
  const firstName = sanitizeSegment(extraction.summary.guest.firstName);
  const lastName = sanitizeSegment(extraction.summary.guest.lastName);
  const directory = path.join(root, `${lastName}_${firstName}`);
  const originDirectory = path.join(directory, 'origin');
  const modifyDirectory = path.join(directory, 'modify');
  const emailDirectory = path.join(directory, 'email');
  const marriottDirectory = path.join(directory, 'marriott');
  const missingStayDirectory = path.join(directory, 'missing-stay');
  const idDirectory = path.join(directory, 'ID');

  await fs.promises.mkdir(originDirectory, { recursive: true });
  await fs.promises.mkdir(modifyDirectory, { recursive: true });
  await fs.promises.mkdir(emailDirectory, { recursive: true });
  await fs.promises.mkdir(marriottDirectory, { recursive: true });
  await fs.promises.mkdir(missingStayDirectory, { recursive: true });
  await fs.promises.mkdir(idDirectory, { recursive: true });
  await fs.promises.copyFile(sourcePdfPath, path.join(originDirectory, path.basename(sourcePdfPath)));

  return {
    root,
    directory,
    originDirectory,
    modifyDirectory,
    emailDirectory,
    marriottDirectory,
    missingStayDirectory,
    idDirectory,
    firstName,
    lastName
  };
}

async function openWorkspace(directory) {
  const originDirectory = path.join(directory, 'origin');
  const modifyDirectory = path.join(directory, 'modify');
  const emailDirectory = path.join(directory, 'email');
  const marriottDirectory = path.join(directory, 'marriott');
  const missingStayDirectory = path.join(directory, 'missing-stay');
  const idDirectory = path.join(directory, 'ID');

  await fs.promises.mkdir(originDirectory, { recursive: true });
  await fs.promises.mkdir(modifyDirectory, { recursive: true });
  await fs.promises.mkdir(emailDirectory, { recursive: true });
  await fs.promises.mkdir(marriottDirectory, { recursive: true });
  await fs.promises.mkdir(missingStayDirectory, { recursive: true });
  await fs.promises.mkdir(idDirectory, { recursive: true });

  return {
    root: path.dirname(directory),
    directory,
    originDirectory,
    modifyDirectory,
    emailDirectory,
    marriottDirectory,
    missingStayDirectory,
    idDirectory
  };
}

async function writeArtifacts({
  workspace,
  originalExtraction,
  modifiedExtraction,
  sourcePdfPath,
  sanitizedPdfPath
}) {
  const originPaths = await writeExtractionArtifacts({
    directory: workspace.originDirectory,
    extraction: originalExtraction,
    sourcePdfPath,
    counterpartPdfPath: sanitizedPdfPath
  });

  await fs.promises.copyFile(sanitizedPdfPath, path.join(workspace.modifyDirectory, path.basename(sanitizedPdfPath)));

  const modifyPaths = await writeExtractionArtifacts({
    directory: workspace.modifyDirectory,
    extraction: modifiedExtraction,
    sourcePdfPath: sanitizedPdfPath,
    counterpartPdfPath: sourcePdfPath
  });

  return {
    origin: {
      directory: workspace.originDirectory,
      pdfPath: path.join(workspace.originDirectory, path.basename(sourcePdfPath)),
      ...originPaths
    },
    modify: {
      directory: workspace.modifyDirectory,
      pdfPath: path.join(workspace.modifyDirectory, path.basename(sanitizedPdfPath)),
      ...modifyPaths
    }
  };
}

async function writeExtractionArtifacts({ directory, extraction, sourcePdfPath, counterpartPdfPath }) {
  const extractedJsonPath = path.join(directory, 'extracted.json');
  const extractedCsvPath = path.join(directory, 'extracted.csv');
  const hiddenJsonPath = path.join(directory, 'hidden-data.json');
  const hiddenCsvPath = path.join(directory, 'hidden-data.csv');
  const metadataJsonPath = path.join(directory, 'pdf-metadata.json');
  const lineItemsCsvPath = path.join(directory, 'line-items.csv');
  const rawStringsPath = path.join(directory, 'raw-strings.txt');
  const visibleTextPath = path.join(directory, 'visible-text.json');

  const extractedJson = {
    sourcePdfPath,
    counterpartPdfPath,
    summary: extraction.summary,
    metadata: extraction.metadata,
    visibleText: extraction.visibleText,
    hiddenData: extraction.hiddenData,
    lineItems: extraction.lineItems
  };

  await fs.promises.writeFile(extractedJsonPath, JSON.stringify(extractedJson, null, 2));
  await fs.promises.writeFile(hiddenJsonPath, JSON.stringify(extraction.hiddenData, null, 2));
  await fs.promises.writeFile(metadataJsonPath, JSON.stringify(extraction.metadata, null, 2));
  await fs.promises.writeFile(rawStringsPath, extraction.rawStrings);
  await fs.promises.writeFile(visibleTextPath, JSON.stringify(extraction.visibleText, null, 2));

  const extractedCsv = stringifyCsv([
    {
      sourcePdfName: extraction.summary.sourcePdfName,
      firstName: extraction.summary.guest.firstName,
      lastName: extraction.summary.guest.lastName,
      fullName: extraction.summary.guest.fullName,
      hotelCode: extraction.summary.stay.hotelCode,
      roomNumber: extraction.summary.stay.roomNumber,
      confirmationNumber: extraction.summary.stay.confirmationNumber,
      checkInDate: extraction.summary.stay.checkInDate,
      checkOutDate: extraction.summary.stay.checkOutDate,
      status: extraction.summary.stay.status,
      balanceAmount: extraction.summary.stay.balanceAmount,
      email: extraction.summary.contact.email,
      phone: extraction.summary.contact.phone,
      uid: extraction.summary.identifiers.uid,
      guestNumber: extraction.summary.identifiers.guestNumber,
      reservationNumber: extraction.summary.identifiers.reservationNumber,
      profileNumber: extraction.summary.identifiers.profileNumber,
      visiblePageCount: extraction.visibleText.pages.length,
      visibleTextLength: extraction.visibleText.fullText.length,
      creator: extraction.metadata.creator,
      producer: extraction.metadata.producer,
      title: extraction.metadata.title,
      creationDate: extraction.metadata.creationDate,
      modDate: extraction.metadata.modDate
    }
  ]);

  const hiddenCsvRows = buildHiddenCsvRows(extraction.hiddenData);
  const lineItemsCsv = stringifyCsv(extraction.lineItems);

  await fs.promises.writeFile(extractedCsvPath, extractedCsv);
  await fs.promises.writeFile(hiddenCsvPath, stringifyCsv(hiddenCsvRows));
  await fs.promises.writeFile(lineItemsCsvPath, lineItemsCsv);

  return {
    extractedJsonPath,
    extractedCsvPath,
    hiddenJsonPath,
    hiddenCsvPath,
    metadataJsonPath,
    lineItemsCsvPath,
    rawStringsPath,
    visibleTextPath
  };
}

async function loadExtractionFromWorkspace(workspaceDirectory, variant = 'origin') {
  const extractionPath = path.join(workspaceDirectory, variant, 'extracted.json');

  if (!fs.existsSync(extractionPath)) {
    throw new Error(`Extracted data not found: ${extractionPath}`);
  }

  return JSON.parse(await fs.promises.readFile(extractionPath, 'utf8'));
}

async function writeEmailArtifacts({
  workspace,
  extraction,
  accountRecord,
  notificationRecord,
  messagePreview
}) {
  const accountJsonPath = path.join(workspace.emailDirectory, 'email-account.json');
  const accountCsvPath = path.join(workspace.emailDirectory, 'email-account.csv');
  const notificationJsonPath = path.join(workspace.emailDirectory, 'notification-email.json');
  const notificationCsvPath = path.join(workspace.emailDirectory, 'notification-email.csv');
  const messageHtmlPath = path.join(workspace.emailDirectory, 'notification-email.html');
  const messageTextPath = path.join(workspace.emailDirectory, 'notification-email.txt');

  await fs.promises.writeFile(accountJsonPath, JSON.stringify(accountRecord, null, 2));
  await fs.promises.writeFile(notificationJsonPath, JSON.stringify(notificationRecord, null, 2));
  await fs.promises.writeFile(messageHtmlPath, messagePreview.html);
  await fs.promises.writeFile(messageTextPath, messagePreview.text);

  const accountCsv = stringifyCsv([
    {
      mailboxEmail: accountRecord.mailboxEmail,
      accountId: accountRecord.accountId,
      accountName: accountRecord.accountName,
      created: accountRecord.created,
      provider: accountRecord.provider,
      apiBaseUrl: accountRecord.apiBaseUrl,
      adminEmail: accountRecord.adminEmail,
      guestFirstName: extraction.summary.guest.firstName,
      guestLastName: extraction.summary.guest.lastName,
      guestFullName: extraction.summary.guest.fullName,
      sourcePdfName: extraction.summary.sourcePdfName
    }
  ]);

  const notificationCsv = stringifyCsv([
    {
      mailboxEmail: notificationRecord.mailboxEmail,
      sendName: notificationRecord.sendName,
      receiveEmail: notificationRecord.receiveEmail,
      subject: notificationRecord.subject,
      sentAt: notificationRecord.sentAt,
      sourcePdfName: extraction.summary.sourcePdfName
    }
  ]);

  await fs.promises.writeFile(accountCsvPath, accountCsv);
  await fs.promises.writeFile(notificationCsvPath, notificationCsv);

  return {
    directory: workspace.emailDirectory,
    accountJsonPath,
    accountCsvPath,
    notificationJsonPath,
    notificationCsvPath,
    messageHtmlPath,
    messageTextPath
  };
}

function buildHiddenCsvRows(hiddenData) {
  const rows = [];

  for (const [key, value] of Object.entries(hiddenData.taggedFields)) {
    rows.push({
      section: 'taggedFields',
      key,
      value
    });
  }

  for (const [key, value] of Object.entries(hiddenData.paramData.guestInfo || {})) {
    rows.push({
      section: 'paramData.guestInfo',
      key,
      value
    });
  }

  for (const entry of hiddenData.folioData.entries || []) {
    rows.push({
      section: 'folioData',
      key: entry.chargeCode,
      value: entry.amount
    });
  }

  for (const entry of hiddenData.folioDetailData.entries || []) {
    rows.push({
      section: 'folioDetailData',
      key: entry.transactionNumber,
      value: `${entry.chargeCode}:${entry.amount}`
    });
  }

  for (const entry of hiddenData.folioTransactionData.entries || []) {
    rows.push({
      section: 'folioTransactionData',
      key: entry.transactionNumber,
      value: `${entry.chargeCode}:${entry.amount}`
    });
  }

  return rows;
}

function sanitizeSegment(value) {
  return String(value || 'unknown')
    .replace(/[/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'unknown';
}

module.exports = {
  createWorkspace,
  openWorkspace,
  loadExtractionFromWorkspace,
  writeEmailArtifacts,
  writeArtifacts
};
