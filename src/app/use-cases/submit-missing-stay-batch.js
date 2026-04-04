const {
  MarriottMissingStaySubmitter
} = require('../../infra/browser/playwright/marriott-missing-stay-submitter');
const { loadStayRecords } = require('../../infra/storage/stay-file-repository');
const {
  appendResult,
  createRunArtifacts,
  writeSummary
} = require('../../infra/storage/run-artifact-repository');
const { notifyRunSummary } = require('../../infra/notify/webhook-notifier');
const { createLogger } = require('../../shared/logger');
const {
  openAuthenticatedMarriottSession
} = require('../support/open-authenticated-marriott-session');

async function submitMissingStayBatch(runtimeConfig) {
  const logger = createLogger(runtimeConfig.env.logLevel);
  const stays = await loadStayRecords(runtimeConfig.inputPath);
  const artifacts = await createRunArtifacts(runtimeConfig.env.resultDir);
  const startedAt = new Date().toISOString();

  logger.info(
    {
      inputPath: runtimeConfig.inputPath,
      totalStays: stays.length,
      runDir: artifacts.runDir,
      dryRun: runtimeConfig.dryRun
    },
    'Missing stay batch started.'
  );

  const results = [];
  let session;

  try {
    if (runtimeConfig.dryRun) {
      for (const stay of stays) {
        const result = {
          stay,
          status: 'dry-run',
          submittedAt: new Date().toISOString(),
          message: 'Dry run succeeded. Input and configuration are valid.'
        };
        results.push(result);
        await appendResult(artifacts.resultsPath, result);
      }
    } else {
      const authSession = await openAuthenticatedMarriottSession({
        runtimeConfig,
        logger,
        mode: 'credentials',
        credentials: {
          username: runtimeConfig.env.username,
          password: runtimeConfig.env.password,
          rememberMe: true
        }
      });

      session = authSession.session;
      const submitter = new MarriottMissingStaySubmitter({
        page: session.page,
        siteConfig: runtimeConfig.siteConfig,
        env: runtimeConfig.env,
        logger,
        runDir: artifacts.runDir
      });

      for (const stay of stays) {
        const result = await submitOneStay({ stay, submitter, logger });
        results.push(result);
        await appendResult(artifacts.resultsPath, result);
      }
    }
  } finally {
    if (session?.browser) {
      await session.browser.close();
    }
  }

  const summary = buildSummary({
    runtimeConfig,
    artifacts,
    startedAt,
    results
  });

  await writeSummary(artifacts.summaryPath, summary);
  await notifyRunSummary({
    webhookUrl: runtimeConfig.env.notifyWebhookUrl,
    summary,
    logger
  }).catch((error) => {
    logger.error({ err: error }, 'Failed to deliver webhook notification.');
  });

  logger.info({ summaryPath: artifacts.summaryPath }, 'Missing stay batch completed.');
  return summary;
}

function buildSummary({ runtimeConfig, artifacts, startedAt, results }) {
  return {
    runId: artifacts.runId,
    startedAt,
    finishedAt: new Date().toISOString(),
    inputPath: runtimeConfig.inputPath,
    siteConfigPath: runtimeConfig.siteConfigPath,
    resultDir: artifacts.runDir,
    total: results.length,
    submitted: results.filter((item) => item.status === 'submitted').length,
    failed: results.filter((item) => item.status === 'failed').length,
    dryRun: results.filter((item) => item.status === 'dry-run').length,
    results
  };
}

async function submitOneStay({ stay, submitter, logger }) {
  try {
    const submission = await submitter.submit(stay);
    return {
      stay,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
      message: submission.message
    };
  } catch (error) {
    logger.error({ err: error, stayId: stay.id }, 'Missing stay submission failed.');
    const screenshotPath = await submitter.captureFailureScreenshot(stay.id).catch(() => undefined);

    return {
      stay,
      status: 'failed',
      submittedAt: new Date().toISOString(),
      message: error.message,
      screenshotPath
    };
  }
}

module.exports = {
  runBatch: submitMissingStayBatch,
  runMissingStayWorkflow: submitMissingStayBatch,
  submitMissingStayBatch
};
