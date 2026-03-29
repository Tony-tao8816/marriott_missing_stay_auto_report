const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const { runtimeEnvSchema, siteConfigSchema } = require('./schema');

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

function loadSiteConfig(siteConfigPath) {
  const resolvedPath = path.resolve(siteConfigPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Site config not found: ${resolvedPath}`);
  }

  const raw = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  return {
    path: resolvedPath,
    value: siteConfigSchema.parse(raw)
  };
}

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
    logLevel: process.env.LOG_LEVEL || 'info',
    notifyWebhookUrl: process.env.NOTIFY_WEBHOOK_URL || undefined
  });

  if (!options.dryRun && (!env.username || !env.password)) {
    throw new Error('MARRIOTT_USERNAME and MARRIOTT_PASSWORD are required unless --dry-run is used.');
  }

  const siteConfig = loadSiteConfig(options.siteConfigPath || 'config/site.json');

  return {
    env,
    inputPath: path.resolve(options.inputPath),
    dryRun: Boolean(options.dryRun),
    siteConfigPath: siteConfig.path,
    siteConfig: siteConfig.value
  };
}

module.exports = {
  loadRuntimeConfig
};
