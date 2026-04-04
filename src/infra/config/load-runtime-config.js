const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const { runtimeEnvSchema, siteConfigSchema } = require('../../domain/schemas');

function loadRuntimeConfig(options = {}) {
  dotenv.config({ path: options.envPath || '.env' });

  const env = runtimeEnvSchema.parse({
    username: process.env.MARRIOTT_USERNAME,
    password: process.env.MARRIOTT_PASSWORD,
    headless: options.headed ? false : parseBoolean(process.env.HEADLESS, true),
    slowMoMs: parseInteger(process.env.SLOW_MO_MS, 0),
    timeoutMs: parseInteger(process.env.TIMEOUT_MS, 30000),
    mfaWaitMs: parseInteger(process.env.MFA_WAIT_MS, 60000),
    resultDir: process.env.RESULT_DIR || 'output',
    sessionStatePath: process.env.SESSION_STATE_PATH || 'output/session/marriott-session.json',
    logLevel: process.env.LOG_LEVEL || 'info',
    notifyWebhookUrl: process.env.NOTIFY_WEBHOOK_URL || undefined
  });

  if (!options.dryRun && (!env.username || !env.password)) {
    throw new Error('MARRIOTT_USERNAME and MARRIOTT_PASSWORD are required unless --dry-run is used.');
  }

  const siteConfigPath = path.resolve(options.siteConfigPath || 'config/site.json');
  if (!fs.existsSync(siteConfigPath)) {
    throw new Error(`Site config not found: ${siteConfigPath}`);
  }

  const siteConfig = siteConfigSchema.parse(JSON.parse(fs.readFileSync(siteConfigPath, 'utf8')));
  const inputPath = path.resolve(options.inputPath);

  return {
    dryRun: Boolean(options.dryRun),
    inputPath,
    siteConfig,
    siteConfigPath,
    env
  };
}

function parseBoolean(value, defaultValue) {
  if (value === undefined || value === '') {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function parseInteger(value, defaultValue) {
  if (value === undefined || value === '') {
    return defaultValue;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

module.exports = {
  loadRuntimeConfig
};
