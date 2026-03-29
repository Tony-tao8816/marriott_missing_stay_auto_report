const path = require('node:path');
const { resolveUrl, sanitizeFileSegment } = require('../utils/paths');

class MarriottClient {
  constructor({ page, siteConfig, logger, env, runDir }) {
    this.page = page;
    this.siteConfig = siteConfig;
    this.logger = logger;
    this.env = env;
    this.runDir = runDir;
  }

  async login({ username, password }) {
    const { login } = this.siteConfig;
    const loginUrl = resolveUrl(this.siteConfig.baseUrl, login.url);

    this.logger.info({ loginUrl }, 'Opening Marriott login page.');
    await this.page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
    await this.page.fill(login.selectors.username, username);
    await this.page.fill(login.selectors.password, password);
    await Promise.all([
      this.page.waitForLoadState('networkidle').catch(() => undefined),
      this.page.click(login.selectors.submit)
    ]);

    if (login.selectors.successIndicator) {
      await this.page.waitForSelector(login.selectors.successIndicator, {
        timeout: this.env.mfaWaitMs
      });
    } else {
      await this.page.waitForTimeout(this.env.mfaWaitMs);
    }

    this.logger.info('Login flow completed.');
  }

  async submitMissingStay(stay) {
    const formUrl = resolveUrl(this.siteConfig.baseUrl, this.siteConfig.missingStay.url);
    const selectors = this.siteConfig.missingStay.selectors;

    this.logger.info({ stayId: stay.id, formUrl }, 'Opening missing stay form.');
    await this.page.goto(formUrl, { waitUntil: 'domcontentloaded' });
    await this.page.fill(selectors.hotelName, stay.hotelName);
    await this.page.fill(selectors.checkInDate, stay.checkInDate);
    await this.page.fill(selectors.checkOutDate, stay.checkOutDate);
    await this.page.fill(selectors.confirmationNumber, stay.confirmationNumber);

    if (selectors.hotelCode && stay.hotelCode) {
      await this.page.fill(selectors.hotelCode, stay.hotelCode);
    }

    if (selectors.country && stay.country) {
      await this.page.selectOption(selectors.country, stay.country);
    }

    if (selectors.notes && stay.notes) {
      await this.page.fill(selectors.notes, stay.notes);
    }

    await Promise.all([
      this.page.waitForLoadState('networkidle').catch(() => undefined),
      this.page.click(selectors.submit)
    ]);

    if (selectors.errorMessage) {
      const errorLocator = this.page.locator(selectors.errorMessage).first();
      const hasVisibleError = await errorLocator.isVisible().catch(() => false);

      if (hasVisibleError) {
        const errorText = await errorLocator.innerText();
        throw new Error(`Marriott page reported an error: ${errorText}`);
      }
    }

    if (selectors.successMessage) {
      const successLocator = this.page.locator(selectors.successMessage).first();
      await successLocator.waitFor({
        state: 'visible',
        timeout: this.env.timeoutMs
      });
      const successText = await successLocator.innerText();
      return {
        status: 'submitted',
        message: successText.trim()
      };
    }

    await this.page.waitForTimeout(this.siteConfig.missingStay.settleDelayMs);
    return {
      status: 'submitted',
      message: 'Submission completed without an explicit success selector.'
    };
  }

  async captureFailureScreenshot(stayId) {
    const targetPath = path.join(
      this.runDir,
      `${sanitizeFileSegment(stayId || 'unknown-stay')}-failure.png`
    );

    await this.page.screenshot({
      path: targetPath,
      fullPage: true
    });

    return targetPath;
  }
}

module.exports = {
  MarriottClient
};
