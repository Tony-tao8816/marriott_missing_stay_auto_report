const fs = require('node:fs');
const path = require('node:path');
const { extractPdfData } = require('../pdf/extract-pdf-data');
const { CloudMailClient } = require('../email/cloud-mail-client');
const { processPdfWorkflow } = require('./process-pdf');
const {
  openWorkspace,
  loadExtractionFromWorkspace,
  writeEmailArtifacts
} = require('../storage/workspace');
const { persistWorkflowRecord } = require('../storage/local-database');

async function registerEmailWorkflow({
  pdfPath,
  workspacePath,
  outputRoot,
  mailApiBaseUrl,
  mailAdminEmail,
  mailAdminPassword,
  mailDomain = 'ryy.asia',
  notifyRecipient = 'tony.stig@icloud.com'
}) {
  if (!mailApiBaseUrl) {
    throw new Error('Missing required option: --mail-api-base-url <url>');
  }

  if (!mailAdminEmail) {
    throw new Error('Missing required option: --mail-admin-email <email>');
  }

  if (!mailAdminPassword) {
    throw new Error('Missing required option: --mail-admin-password <password>');
  }

  const normalizedDomain = normalizeDomain(mailDomain);
  const { extraction, workspace } = await resolveWorkspaceAndExtraction({
    pdfPath,
    workspacePath,
    outputRoot
  });

  const mailboxEmail = buildMailboxEmail(extraction.summary.guest, normalizedDomain);
  if (!isValidEmail(mailboxEmail)) {
    throw new Error(`Generated mailbox is invalid: ${mailboxEmail}`);
  }
  const client = new CloudMailClient({ baseUrl: mailApiBaseUrl });
  const token = await client.genToken({
    email: mailAdminEmail,
    password: mailAdminPassword
  });

  const accounts = await client.listAccounts({ token });
  let account = Array.isArray(accounts)
    ? accounts.find((entry) => normalizeEmail(entry.email) === normalizeEmail(mailboxEmail))
    : null;
  const created = !account;

  if (!account) {
    try {
      account = await client.addAccount({
        token,
        email: mailboxEmail
      });
    } catch (error) {
      throw new Error(`${error.message} (generated mailbox: ${mailboxEmail})`);
    }
  }

  if (account?.accountId && extraction.summary.guest.fullName) {
    await client.setAccountName({
      token,
      accountId: account.accountId,
      name: extraction.summary.guest.fullName
    });

    account = {
      ...account,
      name: extraction.summary.guest.fullName
    };
  }

  const messagePreview = buildNotificationMessage({
    extraction,
    mailboxEmail,
    notifyRecipient
  });

  const sendResponse = await client.sendEmail({
    token,
    sendEmail: mailboxEmail,
    sendName: extraction.summary.guest.fullName || mailboxEmail,
    receiveEmail: notifyRecipient,
    subject: messagePreview.subject,
    content: messagePreview.html,
    text: messagePreview.text
  });

  const accountRecord = {
    provider: 'cloud-mail',
    apiBaseUrl: client.baseUrl,
    adminEmail: maskEmail(mailAdminEmail),
    mailboxEmail,
    accountId: account?.accountId || null,
    accountName: account?.name || extraction.summary.guest.fullName || '',
    created,
    guest: extraction.summary.guest,
    stay: extraction.summary.stay,
    contact: extraction.summary.contact
  };

  const notificationRecord = {
    mailboxEmail,
    sendName: extraction.summary.guest.fullName || mailboxEmail,
    receiveEmail: notifyRecipient,
    subject: messagePreview.subject,
    sentAt: new Date().toISOString(),
    summary: extraction.summary,
    response: sendResponse
  };

  const artifactPaths = await writeEmailArtifacts({
    workspace,
    extraction,
    accountRecord,
    notificationRecord,
    messagePreview
  });

  const databaseRecord = await persistWorkflowRecord({
    workspace,
    extraction,
    mailboxEmail
  });

  return {
    status: 'ok',
    workspaceDirectory: workspace.directory,
    mailboxEmail,
    created,
    artifacts: artifactPaths,
    database: databaseRecord
  };
}

async function resolveWorkspaceAndExtraction({ pdfPath, workspacePath, outputRoot }) {
  if (workspacePath) {
    const absoluteWorkspacePath = path.resolve(workspacePath);
    const workspace = await openWorkspace(absoluteWorkspacePath);
    const extraction = await loadExtractionFromWorkspace(absoluteWorkspacePath, 'origin');
    return { extraction, workspace };
  }

  if (!pdfPath) {
    throw new Error('Missing required option: --pdf <path> or --workspace <path>');
  }

  const absolutePdfPath = path.resolve(pdfPath);

  if (!fs.existsSync(absolutePdfPath)) {
    throw new Error(`PDF not found: ${absolutePdfPath}`);
  }

  const extraction = extractPdfData(absolutePdfPath);
  const pdfResult = await processPdfWorkflow({
    pdfPath: absolutePdfPath,
    outputRoot
  });
  const workspace = await openWorkspace(pdfResult.workspaceDirectory);

  return {
    extraction,
    workspace
  };
}

function buildMailboxEmail(guest, domain) {
  const firstName = normalizeMailboxNamePart(guest.firstName);
  const lastName = normalizeMailboxNamePart(guest.lastName);
  const localPart = [firstName, lastName].filter(Boolean).join('_') || 'guest_account';
  return `${localPart}@${domain}`;
}

function normalizeMailboxNamePart(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9.-]/g, '');
}

function normalizeDomain(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^@+/, '');
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~.-]+@([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(value);
}

function buildNotificationMessage({ extraction, mailboxEmail, notifyRecipient }) {
  const { guest, stay, contact } = extraction.summary;
  const subject = `新账号生成<${guest.firstName},${guest.lastName}>`;
  const description = [
    `已根据 PDF 账单信息完成新邮箱注册，后续将用于 Marriott Missing Stay 流程。`,
    `账单显示客人姓名为 ${guest.fullName}，酒店代码为 ${stay.hotelCode || '未知'}，确认号为 ${stay.confirmationNumber || '未知'}。`,
    `入住日期为 ${stay.checkInDate || '未知'}，离店日期为 ${stay.checkOutDate || '未知'}，房号为 ${stay.roomNumber || '未知'}。`,
    `PDF 中记录的联系邮箱为 ${contact.email || '未知'}，联系电话为 ${contact.phone || '未知'}。`
  ].join(' ');

  const textLines = [
    '注册好了新邮箱。',
    '',
    `新邮箱: ${mailboxEmail}`,
    `姓名: ${guest.fullName}`,
    `名字: ${guest.firstName}`,
    `姓氏: ${guest.lastName}`,
    `酒店代码: ${stay.hotelCode || '未知'}`,
    `确认号: ${stay.confirmationNumber || '未知'}`,
    `入住日期: ${stay.checkInDate || '未知'}`,
    `离店日期: ${stay.checkOutDate || '未知'}`,
    `房号: ${stay.roomNumber || '未知'}`,
    `PDF 联系邮箱: ${contact.email || '未知'}`,
    `PDF 联系电话: ${contact.phone || '未知'}`,
    '',
    `说明: ${description}`,
    '',
    `通知收件人: ${notifyRecipient}`
  ];

  const html = [
    '<p>注册好了新邮箱。</p>',
    `<p>新邮箱: ${escapeHtml(mailboxEmail)}</p>`,
    `<p>姓名: ${escapeHtml(guest.fullName)}</p>`,
    `<p>名字: ${escapeHtml(guest.firstName)}</p>`,
    `<p>姓氏: ${escapeHtml(guest.lastName)}</p>`,
    `<p>酒店代码: ${escapeHtml(stay.hotelCode || '未知')}</p>`,
    `<p>确认号: ${escapeHtml(stay.confirmationNumber || '未知')}</p>`,
    `<p>入住日期: ${escapeHtml(stay.checkInDate || '未知')}</p>`,
    `<p>离店日期: ${escapeHtml(stay.checkOutDate || '未知')}</p>`,
    `<p>房号: ${escapeHtml(stay.roomNumber || '未知')}</p>`,
    `<p>PDF 联系邮箱: ${escapeHtml(contact.email || '未知')}</p>`,
    `<p>PDF 联系电话: ${escapeHtml(contact.phone || '未知')}</p>`,
    `<p>说明: ${escapeHtml(description)}</p>`,
    `<p>通知收件人: ${escapeHtml(notifyRecipient)}</p>`
  ].join('\n');

  return {
    subject,
    text: `${textLines.join('\n')}\n`,
    html
  };
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function maskEmail(email) {
  const normalized = String(email || '').trim();
  const atIndex = normalized.indexOf('@');

  if (atIndex <= 1) {
    return normalized;
  }

  return `${normalized.slice(0, 2)}***${normalized.slice(atIndex)}`;
}

module.exports = {
  registerEmailWorkflow
};
