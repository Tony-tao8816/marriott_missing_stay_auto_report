#!/usr/bin/env node

const path = require('node:path');
const { processPdfWorkflow } = require('../../src/workflows/process-pdf');
const { registerEmailWorkflow } = require('../../src/workflows/register-email');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  const options = parseOptions(args.slice(1));
  let result;

  if (command === 'process-pdf') {
    if (!options.pdf) {
      throw new Error('Missing required option: --pdf <path>');
    }

    result = await processPdfWorkflow({
      pdfPath: path.resolve(options.pdf),
      outputRoot: options.outputRoot ? path.resolve(options.outputRoot) : undefined
    });
  } else if (command === 'register-email') {
    result = await registerEmailWorkflow({
      pdfPath: options.pdf ? path.resolve(options.pdf) : undefined,
      workspacePath: options.workspace ? path.resolve(options.workspace) : undefined,
      outputRoot: options.outputRoot ? path.resolve(options.outputRoot) : undefined,
      mailApiBaseUrl: options.mailApiBaseUrl || process.env.MAIL_API_BASE_URL,
      mailAdminEmail: options.mailAdminEmail || process.env.MAIL_ADMIN_EMAIL,
      mailAdminPassword: options.mailAdminPassword || process.env.MAIL_ADMIN_PASSWORD,
      mailDomain: options.mailDomain || process.env.MAIL_DOMAIN || 'ryy.asia',
      notifyRecipient: options.notifyRecipient || process.env.MAIL_NOTIFY_RECIPIENT || 'tony.stig@icloud.com'
    });
  } else {
    throw new Error(`Unsupported command: ${command}`);
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

function parseOptions(args) {
  const options = {};

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (token === '--pdf') {
      options.pdf = args[index + 1];
      index += 1;
      continue;
    }

    if (token === '--output-root') {
      options.outputRoot = args[index + 1];
      index += 1;
      continue;
    }

    if (token === '--workspace') {
      options.workspace = args[index + 1];
      index += 1;
      continue;
    }

    if (token === '--mail-api-base-url') {
      options.mailApiBaseUrl = args[index + 1];
      index += 1;
      continue;
    }

    if (token === '--mail-admin-email') {
      options.mailAdminEmail = args[index + 1];
      index += 1;
      continue;
    }

    if (token === '--mail-admin-password') {
      options.mailAdminPassword = args[index + 1];
      index += 1;
      continue;
    }

    if (token === '--mail-domain') {
      options.mailDomain = args[index + 1];
      index += 1;
      continue;
    }

    if (token === '--notify-recipient') {
      options.notifyRecipient = args[index + 1];
      index += 1;
      continue;
    }

    if (token === '--help' || token === '-h') {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Unknown option: ${token}`);
  }

  return options;
}

function printHelp() {
  process.stdout.write(`Usage:
  marriott-folio process-pdf --pdf <path> [--output-root <path>]
  marriott-folio register-email (--pdf <path> | --workspace <path>) --mail-api-base-url <url> --mail-admin-email <email> --mail-admin-password <password> [--mail-domain <domain>] [--notify-recipient <email>] [--output-root <path>]

Commands:
  process-pdf    Extract, sanitize, and archive a Marriott folio PDF.
  register-email Create a Cloud Mail mailbox from the PDF guest name and send a notification email.

Options:
  --pdf <path>          PDF file to process
  --workspace <path>    Existing workspace directory created by process-pdf
  --output-root <path>  Override the default output root
  --mail-api-base-url   Cloud Mail base URL, such as https://mail.example.com
  --mail-admin-email    Cloud Mail administrator email
  --mail-admin-password Cloud Mail administrator password
  --mail-domain         Mailbox domain to create, default ryy.asia
  --notify-recipient    Recipient for the notification email, default tony.stig@icloud.com
  -h, --help            Show this help
`);
}

main().catch((error) => {
  process.stderr.write(`Process failed: ${error.message}\n`);
  process.exitCode = 1;
});
