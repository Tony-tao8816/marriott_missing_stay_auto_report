const { createLogger } = require('../../shared/logger');
const {
  openAuthenticatedMarriottSession
} = require('../support/open-authenticated-marriott-session');
const {
  resolveSessionStatePath
} = require('../../infra/storage/session-state-repository');

async function loginMarriottAccount({ emailOrMemberNumber, password, rememberMe, runtimeConfig }) {
  const logger = createLogger(runtimeConfig.env.logLevel);
  const sessionStatePath = resolveSessionStatePath(runtimeConfig.env.sessionStatePath);
  let authSession;

  try {
    authSession = await openAuthenticatedMarriottSession({
      runtimeConfig,
      logger,
      mode: 'credentials',
      credentials: {
        username: emailOrMemberNumber,
        password,
        rememberMe
      }
    });

    return {
      status: 'ok',
      action: 'loginMarriottAccount',
      sessionStatePath,
      message: 'Login completed and session saved.'
    };
  } finally {
    if (authSession?.session?.browser) {
      await authSession.session.browser.close();
    }
  }
}

module.exports = {
  loginMarriottAccount
};
