const { createMarriottSession } = require('../../infra/browser/playwright/marriott-session');
const { MarriottAuthClient } = require('../../infra/browser/playwright/marriott-auth-client');
const {
  ensureSessionStateDir,
  hasSessionState,
  resolveSessionStatePath
} = require('../../infra/storage/session-state-repository');

async function openAuthenticatedMarriottSession({
  runtimeConfig,
  logger,
  mode,
  credentials
}) {
  const sessionStatePath = resolveSessionStatePath(runtimeConfig.env.sessionStatePath);

  if (mode === 'saved') {
    if (!hasSessionState(sessionStatePath)) {
      throw new Error(`Saved session not found: ${sessionStatePath}. Run loginMarriottAccount or createMarriottAccount first.`);
    }

    const session = await createMarriottSession(runtimeConfig.env, {
      storageStatePath: sessionStatePath
    });

    return {
      session,
      sessionStatePath,
      authenticatedBy: 'saved-session'
    };
  }

  if (mode === 'credentials') {
    await ensureSessionStateDir(sessionStatePath);
    const session = await createMarriottSession(runtimeConfig.env);

    const authClient = new MarriottAuthClient({
      page: session.page,
      siteConfig: runtimeConfig.siteConfig,
      env: runtimeConfig.env,
      logger
    });

    await authClient.signIn({
      username: credentials.username,
      password: credentials.password,
      rememberMe: credentials.rememberMe
    });

    await session.context.storageState({ path: sessionStatePath });

    return {
      session,
      sessionStatePath,
      authenticatedBy: 'credentials'
    };
  }

  throw new Error(`Unsupported authentication session mode: ${mode}`);
}

module.exports = {
  openAuthenticatedMarriottSession
};
