const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { openWorkspace } = require('../storage/workspace');
const { DATABASE_FILE_NAME, readWorkflowRecordByWorkspace } = require('../storage/local-database');

const execFileAsync = promisify(execFile);

async function registerMarriottAccountWorkflow({
  workspacePath,
  databasePath,
  opencliCommand = 'opencli',
  country = 'USA',
  rememberMe = false,
  marketingEmails = true,
  incognito = false
}) {
  if (!workspacePath) {
    throw new Error('Missing required option: workspacePath');
  }

  const absoluteWorkspacePath = path.resolve(workspacePath);
  const workspace = await openWorkspace(absoluteWorkspacePath);
  const marriottDirectory = path.join(workspace.directory, 'marriott');
  await fs.promises.mkdir(marriottDirectory, { recursive: true });

  const resolvedDatabasePath = databasePath
    ? path.resolve(databasePath)
    : path.join(workspace.root, DATABASE_FILE_NAME);

  const workflowRecord = await readWorkflowRecordByWorkspace(resolvedDatabasePath, absoluteWorkspacePath);
  if (!workflowRecord) {
    throw new Error(`Workflow record not found for workspace: ${absoluteWorkspacePath}`);
  }

  const args = [
    'createMarriottAccount',
    '--first-name', workflowRecord.firstName,
    '--last-name', workflowRecord.lastName,
    '--country', country,
    '--zip-code', workflowRecord.zipcode,
    '--email', workflowRecord.mailboxEmail,
    '--password', workflowRecord.psw,
    '--remember-me', String(Boolean(rememberMe)),
    '--marketing-emails', String(Boolean(marketingEmails))
  ];

  if (incognito) {
    args.push('--incognito');
  }

  const commandPreview = buildCommandPreview(opencliCommand, args);
  const requestRecord = {
    workspaceDirectory: absoluteWorkspacePath,
    databasePath: resolvedDatabasePath,
    command: 'createMarriottAccount',
    executable: opencliCommand,
    args,
    commandPreview,
    payload: {
      firstName: workflowRecord.firstName,
      lastName: workflowRecord.lastName,
      country,
      zipCode: workflowRecord.zipcode,
      email: workflowRecord.mailboxEmail,
      password: workflowRecord.psw,
      rememberMe: Boolean(rememberMe),
      marketingEmails: Boolean(marketingEmails),
      incognito: Boolean(incognito)
    },
    createdAt: new Date().toISOString()
  };

  const requestJsonPath = path.join(marriottDirectory, 'registration-request.json');
  const resultJsonPath = path.join(marriottDirectory, 'registration-result.json');
  const commandTxtPath = path.join(marriottDirectory, 'registration-command.txt');

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
      commandPreview,
      stdout,
      stderr,
      artifacts: {
        directory: marriottDirectory,
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
      `Marriott registration command failed: ${error.code === 'ENOENT' ? `command not found: ${opencliCommand}` : error.message}`
    );
  }
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
  registerMarriottAccountWorkflow
};
