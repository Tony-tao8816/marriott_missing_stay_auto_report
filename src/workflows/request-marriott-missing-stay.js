const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { openWorkspace } = require('../storage/workspace');
const { DATABASE_FILE_NAME, readWorkflowRecordByWorkspace } = require('../storage/local-database');

const execFileAsync = promisify(execFile);

async function requestMarriottMissingStayWorkflow({
  workspacePath,
  databasePath,
  opencliCommand = 'opencli',
  thirdPartyBooking = 'no',
  billCopy = 'digital',
  comments = 'Please credit this stay',
  incognito = false
}) {
  if (!workspacePath) {
    throw new Error('Missing required option: workspacePath');
  }

  const absoluteWorkspacePath = path.resolve(workspacePath);
  const workspace = await openWorkspace(absoluteWorkspacePath);
  const missingStayDirectory = path.join(workspace.directory, 'missing-stay');
  await fs.promises.mkdir(missingStayDirectory, { recursive: true });

  const resolvedDatabasePath = databasePath
    ? path.resolve(databasePath)
    : path.join(workspace.root, DATABASE_FILE_NAME);

  const workflowRecord = await readWorkflowRecordByWorkspace(resolvedDatabasePath, absoluteWorkspacePath);
  if (!workflowRecord) {
    throw new Error(`Workflow record not found for workspace: ${absoluteWorkspacePath}`);
  }

  const attachmentPath = await resolveSanitizedPdfPath(workspace.modifyDirectory);

  const args = [
    'MarriottMissingStayRequest',
    '--third-party-booking', thirdPartyBooking,
    '--phone-number', workflowRecord.phone,
    '--hotel-name', workflowRecord.hotel,
    '--check-in-date', workflowRecord.arrivalDate,
    '--check-out-date', workflowRecord.departureDate,
    '--bill-copy', billCopy,
    '--confirmation-number', workflowRecord.confirmationNumber,
    '--comments', comments,
    '--attachment', attachmentPath
  ];

  if (incognito) {
    args.push('--incognito');
  }

  const commandPreview = buildCommandPreview(opencliCommand, args);
  const requestRecord = {
    workspaceDirectory: absoluteWorkspacePath,
    databasePath: resolvedDatabasePath,
    command: 'MarriottMissingStayRequest',
    executable: opencliCommand,
    args,
    commandPreview,
    payload: {
      thirdPartyBooking,
      phoneNumber: workflowRecord.phone,
      hotelName: workflowRecord.hotel,
      checkInDate: workflowRecord.arrivalDate,
      checkOutDate: workflowRecord.departureDate,
      billCopy,
      confirmationNumber: workflowRecord.confirmationNumber,
      comments,
      attachment: attachmentPath,
      incognito: Boolean(incognito)
    },
    createdAt: new Date().toISOString()
  };

  const requestJsonPath = path.join(missingStayDirectory, 'missing-stay-request.json');
  const resultJsonPath = path.join(missingStayDirectory, 'missing-stay-result.json');
  const commandTxtPath = path.join(missingStayDirectory, 'missing-stay-command.txt');

  await fs.promises.writeFile(requestJsonPath, JSON.stringify(requestRecord, null, 2));
  await fs.promises.writeFile(commandTxtPath, `${commandPreview}\n`);

  try {
    const { stdout, stderr } = await execFileAsync(opencliCommand, args, {
      maxBuffer: 10 * 1024 * 1024
    });

    const resultRecord = {
      status: 'ok',
      commandPreview,
      stdout,
      stderr,
      completedAt: new Date().toISOString()
    };

    await fs.promises.writeFile(resultJsonPath, JSON.stringify(resultRecord, null, 2));

    return {
      status: 'ok',
      workspaceDirectory: absoluteWorkspacePath,
      databasePath: resolvedDatabasePath,
      attachmentPath,
      commandPreview,
      stdout,
      stderr,
      artifacts: {
        directory: missingStayDirectory,
        requestJsonPath,
        resultJsonPath,
        commandTxtPath
      }
    };
  } catch (error) {
    const resultRecord = {
      status: 'failed',
      commandPreview,
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      error: error.message,
      completedAt: new Date().toISOString()
    };

    await fs.promises.writeFile(resultJsonPath, JSON.stringify(resultRecord, null, 2));

    throw new Error(
      `Missing stay command failed: ${error.code === 'ENOENT' ? `command not found: ${opencliCommand}` : error.message}`
    );
  }
}

async function resolveSanitizedPdfPath(modifyDirectory) {
  const entries = await fs.promises.readdir(modifyDirectory, { withFileTypes: true });
  const pdfEntry = entries.find((entry) => entry.isFile() && entry.name.endsWith('_folio.pdf'));
  if (!pdfEntry) {
    throw new Error(`Sanitized folio PDF not found in: ${modifyDirectory}`);
  }

  return path.join(modifyDirectory, pdfEntry.name);
}

function buildCommandPreview(command, args) {
  return [command, ...args.map(quoteArgument)].join(' ');
}

function quoteArgument(value) {
  const text = String(value ?? '');
  if (/^[a-zA-Z0-9._:@/-]+$/.test(text)) {
    return text;
  }

  return `'${text.replace(/'/g, `'\\''`)}'`;
}

module.exports = {
  requestMarriottMissingStayWorkflow
};
