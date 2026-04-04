const { resolveUrl } = require('../../../shared/paths');

class MarriottRegistrationClient {
  constructor({ page, siteConfig, env, logger }) {
    this.page = page;
    this.siteConfig = siteConfig;
    this.env = env;
    this.logger = logger;
  }

  async createAccount(input) {
    const registrationUrl = resolveUrl(this.siteConfig.baseUrl, this.siteConfig.registration.url);
    const selectors = this.siteConfig.registration.selectors;

    this.logger.info({ registrationUrl }, 'Opening Marriott registration page.');
    await this.page.goto(registrationUrl, { waitUntil: 'domcontentloaded' });

    await this.page.fill(selectors.firstName, input.firstName);
    await this.page.fill(selectors.lastName, input.lastName);
    await this.#selectCountry(selectors.country, input.country);
    await this.page.fill(selectors.zipCode, input.zipCode);
    await this.page.fill(selectors.email, input.email);
    await this.page.fill(selectors.password, input.password);
    await this.page.fill(selectors.confirmPassword, input.password);

    if (selectors.rememberMe) {
      await this.#setCheckbox(selectors.rememberMe, Boolean(input.rememberMe));
    }

    if (input.marketingEmails === true && selectors.marketingEmailsOptIn) {
      await this.#setCheckbox(selectors.marketingEmailsOptIn, true);
    }

    if (input.marketingEmails === false && selectors.marketingEmailsOptOut) {
      await this.#setCheckbox(selectors.marketingEmailsOptOut, true);
    }

    await Promise.all([
      this.page.waitForLoadState('networkidle').catch(() => undefined),
      this.page.click(selectors.submit)
    ]);

    if (selectors.successIndicator) {
      await this.page.waitForSelector(selectors.successIndicator, {
        timeout: this.env.timeoutMs
      });
    }

    this.logger.info({ email: input.email }, 'Marriott account creation completed.');
    return {
      email: input.email,
      message: 'Marriott account creation flow completed.'
    };
  }

  async #selectCountry(selector, countryValue) {
    try {
      await this.page.selectOption(selector, countryValue);
      return;
    } catch (_error) {
      await this.page.click(selector);
      await this.page.locator(`option[value="${countryValue}"]`).click().catch(() => undefined);
      await this.page.getByText(countryValue, { exact: false }).click().catch(() => undefined);
    }
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
  MarriottRegistrationClient
};
