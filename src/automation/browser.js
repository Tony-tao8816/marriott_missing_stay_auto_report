const { chromium } = require('playwright');

async function createBrowserSession(env) {
  const browser = await chromium.launch({
    headless: env.headless,
    slowMo: env.slowMoMs
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  page.setDefaultTimeout(env.timeoutMs);
  page.setDefaultNavigationTimeout(env.timeoutMs);

  return { browser, context, page };
}

module.exports = {
  createBrowserSession
};
