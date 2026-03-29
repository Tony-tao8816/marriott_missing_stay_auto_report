#!/usr/bin/env node

const { Command } = require('commander');
const { loadRuntimeConfig } = require('./config/env');
const { runBatch } = require('./automation/run-batch');

const program = new Command();

program
  .name('marriott-missing-stay')
  .description('Automate Marriott missing stay submissions with Node.js and Playwright.');

program
  .command('run')
  .requiredOption('-i, --input <path>', 'Path to a JSON or CSV file containing missing stay records.')
  .option('-s, --site-config <path>', 'Path to site config JSON.', 'config/site.json')
  .option('--env-file <path>', 'Path to the .env file.', '.env')
  .option('--dry-run', 'Validate config and input without opening a browser.', false)
  .option('--headed', 'Run the browser with a visible UI.', false)
  .action(async (options) => {
    try {
      const config = loadRuntimeConfig({
        inputPath: options.input,
        siteConfigPath: options.siteConfig,
        envPath: options.envFile,
        dryRun: options.dryRun,
        headed: options.headed
      });

      const summary = await runBatch(config);
      process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
      process.exitCode = summary.failed > 0 ? 1 : 0;
    } catch (error) {
      process.stderr.write(`Run failed: ${error.message}\n`);
      process.exitCode = 1;
    }
  });

program
  .command('validate-config')
  .requiredOption('-s, --site-config <path>', 'Path to site config JSON.')
  .option('--env-file <path>', 'Path to the .env file.', '.env')
  .option('--dry-run', 'Skip credential validation.', true)
  .action((options) => {
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
            resultDir: config.env.resultDir
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

program.parseAsync(process.argv);
