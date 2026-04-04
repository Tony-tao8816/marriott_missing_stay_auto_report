const path = require('node:path');
const { resolveUrl, sanitizeFileSegment } = require('../../../shared/paths');

class MarriottMissingStaySubmitter {
  constructor({ page, siteConfig, env, logger, runDir }) {
    this.page = page;
    this.siteConfig = siteConfig;
    this.env = env;
    this.logger = logger;
    this.runDir = runDir;
  }

  async submit(stay) {
    const formUrl = resolveUrl(this.siteConfig.baseUrl, this.siteConfig.missingStay.url);
    const selectors = this.siteConfig.missingStay.selectors;

    this.logger.info({ stayId: stay.id, formUrl }, 'Opening missing stay form.');
    await this.page.goto(formUrl, { waitUntil: 'domcontentloaded' });

    if (stay.thirdPartyBooking === 'yes' && selectors.thirdPartyBookingYes) {
      await this.page.click(selectors.thirdPartyBookingYes);
    }

    if (stay.thirdPartyBooking === 'no' && selectors.thirdPartyBookingNo) {
      await this.page.click(selectors.thirdPartyBookingNo);
    }

    if (selectors.phoneNumber && stay.phoneNumber) {
      await this.page.fill(selectors.phoneNumber, stay.phoneNumber);
    }

    await this.page.fill(selectors.hotelName, stay.hotelName);
    await this.page.fill(selectors.checkInDate, stay.checkInDate);
    await this.page.fill(selectors.checkOutDate, stay.checkOutDate);

    if (stay.billCopy === 'digital' && selectors.billCopyDigital) {
      await this.page.click(selectors.billCopyDigital);
    }

    if (stay.billCopy === 'mail' && selectors.billCopyMail) {
      await this.page.click(selectors.billCopyMail);
    }

    await this.page.fill(selectors.confirmationNumber, stay.confirmationNumber);

    if (selectors.roomNumber && stay.roomNumber) {
      await this.page.fill(selectors.roomNumber, stay.roomNumber);
    }

    if (selectors.memberNumber && stay.memberNumber) {
      await this.page.fill(selectors.memberNumber, stay.memberNumber);
    }

    if (selectors.hotelCode && stay.hotelCode) {
      await this.page.fill(selectors.hotelCode, stay.hotelCode);
    }

    if (selectors.country && stay.country) {
      await this.page.selectOption(selectors.country, stay.country);
    }

    if (selectors.notes && stay.notes) {
      await this.page.fill(selectors.notes, stay.notes);
    }

    if (selectors.attachmentInput && stay.attachmentPath) {
      await this.page.setInputFiles(selectors.attachmentInput, stay.attachmentPath);
    }

    await Promise.all([
      this.page.waitForLoadState('networkidle').catch(() => undefined),
      this.page.click(selectors.submit)
    ]);

    const errorMessage = await this.#readVisibleText(selectors.errorMessage);
    if (errorMessage) {
      throw new Error(`Marriott page reported an error: ${errorMessage}`);
    }

    const successMessage = await this.#readVisibleText(selectors.successMessage);
    if (successMessage) {
      return {
        message: successMessage
      };
    }

    await this.page.waitForTimeout(this.siteConfig.missingStay.settleDelayMs);
    return {
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

  async #readVisibleText(selector) {
    if (!selector) {
      return null;
    }

    const locator = this.page.locator(selector).first();
    const visible = await locator.isVisible().catch(() => false);

    if (!visible) {
      return null;
    }

    const value = await locator.innerText().catch(() => '');
    return String(value || '').trim() || null;
  }
}

module.exports = {
  MarriottClient: MarriottMissingStaySubmitter,
  MarriottMissingStayClient: MarriottMissingStaySubmitter,
  MarriottMissingStaySubmitter
};
