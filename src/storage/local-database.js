const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

const DATABASE_FILE_NAME = 'marriott_folio.sqlite';
const DEFAULT_HOTEL = 'Rissai Valley, a Ritz-Carlton Reserve';

async function persistWorkflowRecord({ workspace, extraction, mailboxEmail }) {
  const databasePath = path.join(workspace.root, DATABASE_FILE_NAME);
  await ensureSchema(databasePath);
  const existingRecord = await readWorkflowRecordByWorkspace(databasePath, workspace.directory);
  const record = buildWorkflowRecord({ workspace, extraction, mailboxEmail, existingRecord });
  const sql = buildUpsertSql(record);

  await execSqlite(databasePath, sql);

  return {
    databasePath,
    table: 'workflow_records',
    record
  };
}

async function readWorkflowRecords(databasePath) {
  await ensureSchema(databasePath);
  const sql = `
SELECT
  workspace_directory,
  first_name,
  last_name,
  hotel,
  total,
  arrival_date,
  departure_date,
  room_number,
  confirmation_number,
  mailbox_email,
  psw,
  phone,
  zipcode,
  updated_at
FROM workflow_records
ORDER BY updated_at DESC, id DESC;
`.trim();

  const stdout = await execSqlite(databasePath, sql);
  const rows = String(stdout || '')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(parseWorkflowRecordRow);

  return {
    databasePath,
    table: 'workflow_records',
    count: rows.length,
    rows
  };
}

async function updateWorkflowRecord(databasePath, workspaceDirectory, field, value) {
  await ensureSchema(databasePath);

  const column = FIELD_TO_COLUMN[field];
  if (!column) {
    throw new Error(`Unsupported database field: ${field}`);
  }

  const normalizedValue = normalizeDatabaseFieldValue(field, value);
  const updatedAt = new Date().toISOString();
  await execSqlite(
    databasePath,
    `
PRAGMA journal_mode=WAL;
UPDATE workflow_records
SET ${column} = ${sqlLiteral(normalizedValue)}, updated_at = ${sqlLiteral(updatedAt)}
WHERE workspace_directory = ${sqlLiteral(workspaceDirectory)};
`.trim()
  );

  const record = await readWorkflowRecordByWorkspace(databasePath, workspaceDirectory);
  if (!record) {
    throw new Error(`Workflow record not found: ${workspaceDirectory}`);
  }

  return {
    databasePath,
    table: 'workflow_records',
    record
  };
}

function buildWorkflowRecord({ workspace, extraction, mailboxEmail, existingRecord }) {
  const firstName = extraction.summary.guest.firstName || '';
  const lastName = extraction.summary.guest.lastName || '';

  return {
    workspaceDirectory: workspace.directory,
    firstName,
    lastName,
    hotel: DEFAULT_HOTEL,
    total: extraction.summary.stay.balanceAmount || '',
    arrivalDate: extraction.summary.stay.checkInDate || '',
    departureDate: extraction.summary.stay.checkOutDate || '',
    roomNumber: extraction.summary.stay.roomNumber || '',
    confirmationNumber: normalizeConfirmationNumber(
      getVisibleConfirmationNumber(extraction) || extraction.summary.stay.confirmationNumber || ''
    ),
    mailboxEmail: mailboxEmail || '',
    psw: buildPsw(firstName, lastName),
    phone: existingRecord?.phone || buildPhone(),
    zipcode: existingRecord?.zipcode || buildCaliforniaZipcode(),
    updatedAt: new Date().toISOString()
  };
}

const FIELD_TO_COLUMN = {
  firstName: 'first_name',
  lastName: 'last_name',
  hotel: 'hotel',
  total: 'total',
  arrivalDate: 'arrival_date',
  departureDate: 'departure_date',
  roomNumber: 'room_number',
  confirmationNumber: 'confirmation_number',
  mailboxEmail: 'mailbox_email',
  psw: 'psw',
  phone: 'phone',
  zipcode: 'zipcode'
};

function normalizeDatabaseFieldValue(field, value) {
  if (field === 'confirmationNumber') {
    return normalizeConfirmationNumber(value);
  }

  return String(value ?? '').trim();
}

function buildUpsertSql(record) {
  const values = {
    workspaceDirectory: sqlLiteral(record.workspaceDirectory),
    firstName: sqlLiteral(record.firstName),
    lastName: sqlLiteral(record.lastName),
    hotel: sqlLiteral(record.hotel),
    total: sqlLiteral(record.total),
    arrivalDate: sqlLiteral(record.arrivalDate),
    departureDate: sqlLiteral(record.departureDate),
    roomNumber: sqlLiteral(record.roomNumber),
    confirmationNumber: sqlLiteral(record.confirmationNumber),
    mailboxEmail: sqlLiteral(record.mailboxEmail),
    psw: sqlLiteral(record.psw),
    phone: sqlLiteral(record.phone),
    zipcode: sqlLiteral(record.zipcode),
    updatedAt: sqlLiteral(record.updatedAt)
  };

  return `
PRAGMA journal_mode=WAL;
INSERT INTO workflow_records (
  workspace_directory,
  first_name,
  last_name,
  hotel,
  total,
  arrival_date,
  departure_date,
  room_number,
  confirmation_number,
  mailbox_email,
  psw,
  phone,
  zipcode,
  updated_at
) VALUES (
  ${values.workspaceDirectory},
  ${values.firstName},
  ${values.lastName},
  ${values.hotel},
  ${values.total},
  ${values.arrivalDate},
  ${values.departureDate},
  ${values.roomNumber},
  ${values.confirmationNumber},
  ${values.mailboxEmail},
  ${values.psw},
  ${values.phone},
  ${values.zipcode},
  ${values.updatedAt}
)
ON CONFLICT(workspace_directory) DO UPDATE SET
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  hotel = excluded.hotel,
  total = excluded.total,
  arrival_date = excluded.arrival_date,
  departure_date = excluded.departure_date,
  room_number = excluded.room_number,
  confirmation_number = excluded.confirmation_number,
  mailbox_email = excluded.mailbox_email,
  psw = excluded.psw,
  phone = excluded.phone,
  zipcode = excluded.zipcode,
  updated_at = excluded.updated_at;
`.trim();
}

async function ensureSchema(databasePath) {
  await execSqlite(
    databasePath,
    `
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS workflow_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_directory TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  hotel TEXT,
  total TEXT,
  arrival_date TEXT,
  departure_date TEXT,
  room_number TEXT,
  confirmation_number TEXT,
  mailbox_email TEXT,
  psw TEXT,
  phone TEXT,
  zipcode TEXT,
  updated_at TEXT NOT NULL
);
`.trim()
  );

  const columns = await getExistingColumns(databasePath, 'workflow_records');

  if (!columns.includes('psw')) {
    await execSqlite(
      databasePath,
      `ALTER TABLE workflow_records ADD COLUMN psw TEXT;`
    );
  }

  if (!columns.includes('phone')) {
    await execSqlite(
      databasePath,
      `ALTER TABLE workflow_records ADD COLUMN phone TEXT;`
    );
  }

  if (!columns.includes('zipcode')) {
    await execSqlite(
      databasePath,
      `ALTER TABLE workflow_records ADD COLUMN zipcode TEXT;`
    );
  }

  if (!columns.includes('hotel')) {
    await execSqlite(
      databasePath,
      `ALTER TABLE workflow_records ADD COLUMN hotel TEXT;`
    );
  }

  if (!columns.includes('total')) {
    await execSqlite(
      databasePath,
      `ALTER TABLE workflow_records ADD COLUMN total TEXT;`
    );
  }
}

async function readWorkflowRecordByWorkspace(databasePath, workspaceDirectory) {
  const stdout = await execSqlite(
    databasePath,
    `
SELECT
  workspace_directory,
  first_name,
  last_name,
  hotel,
  total,
  arrival_date,
  departure_date,
  room_number,
  confirmation_number,
  mailbox_email,
  psw,
  phone,
  zipcode,
  updated_at
FROM workflow_records
WHERE workspace_directory = ${sqlLiteral(workspaceDirectory)}
LIMIT 1;
`.trim()
  );

  const line = String(stdout || '').trim();
  return line ? parseWorkflowRecordRow(line) : null;
}

async function getExistingColumns(databasePath, tableName) {
  const stdout = await execSqlite(databasePath, `PRAGMA table_info(${tableName});`);
  return String(stdout || '')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('|')[1])
    .filter(Boolean);
}

function sqlLiteral(value) {
  return `'${String(value || '').replace(/'/g, "''")}'`;
}

function buildPsw(firstName, lastName) {
  const lastInitial = getNameInitial(lastName).toUpperCase() || 'X';
  const firstInitial = getNameInitial(firstName).toLowerCase() || 'x';
  return `${lastInitial}${firstInitial}@marriott`;
}

function parseWorkflowRecordRow(line) {
  const [
    workspaceDirectory = '',
    firstName = '',
    lastName = '',
    hotel = '',
    total = '',
    arrivalDate = '',
    departureDate = '',
    roomNumber = '',
    confirmationNumber = '',
    mailboxEmail = '',
    psw = '',
    phone = '',
    zipcode = '',
    updatedAt = ''
  ] = String(line).split('|');

  return {
    workspaceDirectory,
    firstName,
    lastName,
    hotel,
    total,
    arrivalDate,
    departureDate,
    roomNumber,
    confirmationNumber,
    mailboxEmail,
    psw,
    phone,
    zipcode,
    updatedAt
  };
}

function getNameInitial(value) {
  const normalized = String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^a-zA-Z0-9]/g, '');

  return normalized.charAt(0);
}

function getVisibleConfirmationNumber(extraction) {
  return String(
    extraction?.visibleText?.fields?.confirmationNumber ||
    extraction?.visibleText?.confirmationNumber ||
    ''
  ).trim();
}

function normalizeConfirmationNumber(value) {
  const text = String(value || '').trim();
  const exactMatch = text.match(/\d{8}/);
  if (exactMatch) {
    return exactMatch[0];
  }

  const digitsOnly = text.replace(/\D/g, '');
  return digitsOnly.slice(0, 8);
}

function buildPhone() {
  return String(Math.floor(10000000 + Math.random() * 90000000));
}

function buildCaliforniaZipcode() {
  const californiaZipcodes = [
    '90001',
    '90012',
    '90210',
    '90401',
    '90650',
    '90802',
    '91006',
    '91101',
    '91324',
    '91502',
    '91711',
    '91910',
    '92101',
    '92262',
    '92335',
    '92408',
    '92501',
    '92618',
    '92705',
    '92805',
    '93003',
    '93101',
    '93401',
    '93550',
    '93612',
    '93721',
    '93940',
    '94016',
    '94103',
    '94301',
    '94401',
    '94538',
    '94607',
    '94704',
    '95014',
    '95113',
    '95616',
    '95814',
    '95928',
    '96001'
  ];

  return californiaZipcodes[Math.floor(Math.random() * californiaZipcodes.length)];
}

async function execSqlite(databasePath, sql) {
  try {
    const { stdout } = await execFileAsync('sqlite3', [databasePath, sql], {
      maxBuffer: 10 * 1024 * 1024
    });
    return stdout;
  } catch (error) {
    const details = (error.stderr || error.message || 'Unknown sqlite3 error').trim();
    throw new Error(`Failed to persist workflow record: ${details}`);
  }
}

module.exports = {
  DATABASE_FILE_NAME,
  DEFAULT_HOTEL,
  persistWorkflowRecord,
  readWorkflowRecords,
  updateWorkflowRecord
};
