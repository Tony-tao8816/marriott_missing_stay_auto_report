const { createMarriottSession } = require('../../infra/browser/playwright/marriott-session');
const {
  MarriottRegistrationClient
} = require('../../infra/browser/playwright/marriott-registration-client');
const {
  ensureSessionStateDir,
  resolveSessionStatePath
} = require('../../infra/storage/session-state-repository');
const { createLogger } = require('../../shared/logger');

async function createMarriottAccount(input) {
  const logger = createLogger(input.runtimeConfig.env.logLevel);
  const sessionStatePath = resolveSessionStatePath(input.runtimeConfig.env.sessionStatePath);
  let session;

  try {
    await ensureSessionStateDir(sessionStatePath);
    session = await createMarriottSession(input.runtimeConfig.env);

    const client = new MarriottRegistrationClient({
      page: session.page,
      siteConfig: input.runtimeConfig.siteConfig,
      env: input.runtimeConfig.env,
      logger
    });

    const result = await client.createAccount(input);
    await session.context.storageState({ path: sessionStatePath });

    return {
      status: 'ok',
      action: 'createMarriottAccount',
      email: result.email,
      sessionStatePath,
      message: result.message
    };
  } finally {
    if (session?.browser) {
      await session.browser.close();
    }
  }
}

module.exports = {
  createMarriottAccount
};
