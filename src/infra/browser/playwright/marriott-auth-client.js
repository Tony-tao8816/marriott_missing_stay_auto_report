const { resolveUrl } = require('../../../shared/paths');

class MarriottAuthClient {
  constructor({ page, siteConfig, env, logger }) {
    this.page = page;
    this.siteConfig = siteConfig;
    this.env = env;
    this.logger = logger;
  }

  async signIn({ username, password, rememberMe }) {
    const loginUrl = resolveUrl(this.siteConfig.baseUrl, this.siteConfig.login.url);
    const selectors = this.siteConfig.login.selectors;

    this.logger.info({ loginUrl }, 'Opening Marriott sign-in page.');
    await this.page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
    await this.page.fill(selectors.username, username);
    await this.page.fill(selectors.password, password);

    if (selectors.rememberMe && rememberMe !== undefined) {
      await this.#setCheckbox(selectors.rememberMe, Boolean(rememberMe));
    }

    await Promise.all([
      this.page.waitForLoadState('networkidle').catch(() => undefined),
      this.page.click(selectors.submit)
    ]);

    if (selectors.successIndicator) {
      await this.page.waitForSelector(selectors.successIndicator, {
        timeout: this.env.mfaWaitMs
      });
    } else {
      await this.page.waitForTimeout(this.env.mfaWaitMs);
    }

    this.logger.info('Marriott sign-in completed.');
  }

  async #setCheckbox(selector, checked) {
    const locator = this.page.locator(selector).first();
    const current = await locator.isChecked().catch(() => null);

    if (current === checked) {
      return;
    }

    await locator.click();
  }
}

module.exports = {
  MarriottAuthClient
};
