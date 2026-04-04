const {
  MarriottMissingStaySubmitter
} = require('../../infra/browser/playwright/marriott-missing-stay-submitter');
const {
  createRunArtifacts,
  writeSummary
} = require('../../infra/storage/run-artifact-repository');
const { notifyRunSummary } = require('../../infra/notify/webhook-notifier');
const { createLogger } = require('../../shared/logger');
const {
  openAuthenticatedMarriottSession
} = require('../support/open-authenticated-marriott-session');

async function requestMarriottMissingStay(input) {
  const logger = createLogger(input.runtimeConfig.env.logLevel);
  const artifacts = await createRunArtifacts(input.runtimeConfig.env.resultDir);
  let authSession;

  try {
    authSession = await openAuthenticatedMarriottSession({
      runtimeConfig: input.runtimeConfig,
      logger,
      mode: 'saved'
    });
    const session = authSession.session;

    const submitter = new MarriottMissingStaySubmitter({
      page: session.page,
      siteConfig: input.runtimeConfig.siteConfig,
      env: input.runtimeConfig.env,
      logger,
      runDir: artifacts.runDir
    });

    const submission = await submitter.submit({
      id: input.confirmationNumber,
      thirdPartyBooking: input.thirdPartyBooking,
      phoneNumber: input.phoneNumber,
      hotelName: input.hotelName,
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
      billCopy: input.billCopy,
      confirmationNumber: input.confirmationNumber,
      comments: input.comments,
      notes: input.comments,
      attachmentPath: input.attachment
    });

    const summary = {
      action: 'MarriottMissingStayRequest',
      status: 'submitted',
      resultDir: artifacts.runDir,
      submittedAt: new Date().toISOString(),
      request: {
        confirmationNumber: input.confirmationNumber,
        hotelName: input.hotelName,
        checkInDate: input.checkInDate,
        checkOutDate: input.checkOutDate
      },
      message: submission.message
    };

    await writeSummary(artifacts.summaryPath, summary);
    await notifyRunSummary({
      webhookUrl: input.runtimeConfig.env.notifyWebhookUrl,
      summary,
      logger
    }).catch(() => undefined);

    return summary;
  } finally {
    if (authSession?.session?.browser) {
      await authSession.session.browser.close();
    }
  }
}

module.exports = {
  requestMarriottMissingStay
};
