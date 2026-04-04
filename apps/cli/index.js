#!/usr/bin/env node

const { Command } = require('commander');
const { loadRuntimeConfig } = require('../../src/infra/config/load-runtime-config');
const { loginMarriottAccount } = require('../../src/app/use-cases/login-marriott-account');
const { createMarriottAccount } = require('../../src/app/use-cases/create-marriott-account');
const {
  requestMarriottMissingStay
} = require('../../src/app/use-cases/request-marriott-missing-stay');
const {
  runMarriottIntegratedFlow
} = require('../../src/app/use-cases/run-marriott-integrated-flow');
const {
  submitMissingStayBatch
} = require('../../src/app/use-cases/submit-missing-stay-batch');

const program = new Command();

program
  .name('opencli')
  .description('Automate Marriott account and missing-stay flows with Node.js and Playwright.');

addSharedRuntimeOptions(
  program
    .command('loginMarriottAccount')
    .requiredOption('--email-or-member-number <value>', 'Marriott email or member number')
    .requiredOption('--password <value>', 'Marriott password')
    .option('--remember-me <value>', 'Remember me flag', 'true')
).action(async (options) => {
  try {
    const runtimeConfig = loadRuntimeConfig({
      inputPath: 'data/stays.example.json',
      siteConfigPath: options.siteConfig,
      envPath: options.envFile,
      dryRun: true,
      headed: options.headed
    });

    const result = await loginMarriottAccount({
      emailOrMemberNumber: options.emailOrMemberNumber,
      password: options.password,
      rememberMe: parseBooleanOption(options.rememberMe),
      runtimeConfig
    });

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`Login failed: ${error.message}\n`);
    process.exitCode = 1;
  }
});

addSharedRuntimeOptions(
  program
    .command('createMarriottAccount')
    .requiredOption('--first-name <value>', 'First name')
    .requiredOption('--last-name <value>', 'Last name')
    .requiredOption('--country <value>', 'Country value to select')
    .requiredOption('--zip-code <value>', 'Zip or postal code')
    .requiredOption('--email <value>', 'Account email')
    .requiredOption('--password <value>', 'Account password')
    .option('--remember-me <value>', 'Remember me flag', 'true')
    .option('--marketing-emails <value>', 'Marketing emails flag', 'false')
).action(async (options) => {
  try {
    const runtimeConfig = loadRuntimeConfig({
      inputPath: 'data/stays.example.json',
      siteConfigPath: options.siteConfig,
      envPath: options.envFile,
      dryRun: true,
      headed: options.headed
    });

    const result = await createMarriottAccount({
      firstName: options.firstName,
      lastName: options.lastName,
      country: options.country,
      zipCode: options.zipCode,
      email: options.email,
      password: options.password,
      rememberMe: parseBooleanOption(options.rememberMe),
      marketingEmails: parseBooleanOption(options.marketingEmails),
      runtimeConfig
    });

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`Account creation failed: ${error.message}\n`);
    process.exitCode = 1;
  }
});

addSharedRuntimeOptions(
  program
    .command('MarriottMissingStayRequest')
    .requiredOption('--third-party-booking <value>', 'yes or no')
    .requiredOption('--phone-number <value>', 'Phone number')
    .requiredOption('--hotel-name <value>', 'Hotel name')
    .requiredOption('--check-in-date <value>', 'Check-in date YYYY-MM-DD')
    .requiredOption('--check-out-date <value>', 'Check-out date YYYY-MM-DD')
    .requiredOption('--bill-copy <value>', 'digital or mail')
    .requiredOption('--confirmation-number <value>', 'Confirmation number')
    .option('--comments <value>', 'Comments for the request')
    .option('--attachment <path>', 'Attachment PDF path')
).action(async (options) => {
  try {
    const runtimeConfig = loadRuntimeConfig({
      inputPath: 'data/stays.example.json',
      siteConfigPath: options.siteConfig,
      envPath: options.envFile,
      dryRun: true,
      headed: options.headed
    });

    const result = await requestMarriottMissingStay({
      thirdPartyBooking: options.thirdPartyBooking,
      phoneNumber: options.phoneNumber,
      hotelName: options.hotelName,
      checkInDate: options.checkInDate,
      checkOutDate: options.checkOutDate,
      billCopy: options.billCopy,
      confirmationNumber: options.confirmationNumber,
      comments: options.comments,
      attachment: options.attachment,
      runtimeConfig
    });

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`Missing stay request failed: ${error.message}\n`);
    process.exitCode = 1;
  }
});

addSharedRuntimeOptions(
  program
    .command('MarriottIntegratedFlow')
    .requiredOption('--account-mode <value>', 'login, create, or session')
    .option('--email-or-member-number <value>', 'Marriott email or member number for login mode')
    .option('--first-name <value>', 'First name for create mode')
    .option('--last-name <value>', 'Last name for create mode')
    .option('--country <value>', 'Country value for create mode')
    .option('--zip-code <value>', 'Zip code for create mode')
    .option('--email <value>', 'Email for create mode')
    .option('--password <value>', 'Password for login/create mode')
    .option('--remember-me <value>', 'Remember me flag', 'true')
    .option('--marketing-emails <value>', 'Marketing emails flag', 'false')
    .requiredOption('--third-party-booking <value>', 'yes or no')
    .requiredOption('--phone-number <value>', 'Phone number')
    .requiredOption('--hotel-name <value>', 'Hotel name')
    .requiredOption('--check-in-date <value>', 'Check-in date YYYY-MM-DD')
    .requiredOption('--check-out-date <value>', 'Check-out date YYYY-MM-DD')
    .requiredOption('--bill-copy <value>', 'digital or mail')
    .requiredOption('--confirmation-number <value>', 'Confirmation number')
    .option('--comments <value>', 'Comments for the request')
    .option('--attachment <path>', 'Attachment PDF path')
).action(async (options) => {
  try {
    const runtimeConfig = loadRuntimeConfig({
      inputPath: 'data/stays.example.json',
      siteConfigPath: options.siteConfig,
      envPath: options.envFile,
      dryRun: true,
      headed: options.headed
    });

    const result = await runMarriottIntegratedFlow({
      accountMode: options.accountMode,
      emailOrMemberNumber: options.emailOrMemberNumber,
      firstName: options.firstName,
      lastName: options.lastName,
      country: options.country,
      zipCode: options.zipCode,
      email: options.email,
      password: options.password,
      rememberMe: parseBooleanOption(options.rememberMe),
      marketingEmails: parseBooleanOption(options.marketingEmails),
      thirdPartyBooking: options.thirdPartyBooking,
      phoneNumber: options.phoneNumber,
      hotelName: options.hotelName,
      checkInDate: options.checkInDate,
      checkOutDate: options.checkOutDate,
      billCopy: options.billCopy,
      confirmationNumber: options.confirmationNumber,
      comments: options.comments,
      attachment: options.attachment,
      runtimeConfig
    });

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`Integrated flow failed: ${error.message}\n`);
    process.exitCode = 1;
  }
});

addSharedRuntimeOptions(
  program
    .command('run')
    .requiredOption('-i, --input <path>', 'Path to a JSON or CSV file containing missing stay records.')
    .option('--dry-run', 'Validate config and input without opening a browser.', false)
).action(async (options) => {
  try {
    const config = loadRuntimeConfig({
      inputPath: options.input,
      siteConfigPath: options.siteConfig,
      envPath: options.envFile,
      dryRun: options.dryRun,
      headed: options.headed
    });

    const summary = await submitMissingStayBatch(config);
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    process.exitCode = summary.failed > 0 ? 1 : 0;
  } catch (error) {
    process.stderr.write(`Run failed: ${error.message}\n`);
    process.exitCode = 1;
  }
});

addSharedRuntimeOptions(
  program
    .command('validate-config')
    .option('--dry-run', 'Skip credential validation.', true)
).action((options) => {
  try {
    const config = loadRuntimeConfig({
      inputPath: 'data/stays.example.json',
      siteConfigPath: options.siteConfig,
      envPath: options.envFile,
      dryRun: options.dryRun,
      headed: false
    });

    process.stdout.write(
      `${JSON.stringify(
        {
          status: 'ok',
          siteConfigPath: config.siteConfigPath,
          resultDir: config.env.resultDir,
          sessionStatePath: config.env.sessionStatePath
        },
        null,
        2
      )}\n`
    );
  } catch (error) {
    process.stderr.write(`Validation failed: ${error.message}\n`);
    process.exitCode = 1;
  }
});

function addSharedRuntimeOptions(command) {
  return command
    .option('-s, --site-config <path>', 'Path to site config JSON.', 'config/site.json')
    .option('--env-file <path>', 'Path to the .env file.', '.env')
    .option('--headed', 'Run the browser with a visible UI.', false);
}

function parseBooleanOption(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

program.parseAsync(process.argv);
