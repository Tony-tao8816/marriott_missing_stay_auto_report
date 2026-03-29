const { createBrowserSession } = require('./browser');
const { MarriottClient } = require('./marriott-client');
const { loadStayRecords } = require('../io/stay-loader');
const { appendResult, createRunArtifacts, writeSummary } = require('../io/result-recorder');
const { notifyRunSummary } = require('../notify/webhook-notifier');
const { createLogger } = require('../utils/logger');

async function runBatch(runtimeConfig) {
  const logger = createLogger(runtimeConfig.env.logLevel);
  const records = await loadStayRecords(runtimeConfig.inputPath);
  const artifacts = await createRunArtifacts(runtimeConfig.env.resultDir);
  const startedAt = new Date().toISOString();

  logger.info(
    {
      inputPath: runtimeConfig.inputPath,
      count: records.length,
      runDir: artifacts.runDir,
      dryRun: runtimeConfig.dryRun
    },
    'Batch run started.'
  );

  const results = [];
  let browserSession;

  try {
    if (!runtimeConfig.dryRun) {
      browserSession = await createBrowserSession(runtimeConfig.env);
      const client = new MarriottClient({
        page: browserSession.page,
        siteConfig: runtimeConfig.siteConfig,
        logger,
        env: runtimeConfig.env,
        runDir: artifacts.runDir
      });

      await client.login({
        username: runtimeConfig.env.username,
        password: runtimeConfig.env.password
      });

      for (const stay of records) {
        const result = await submitOneStay({ client, stay, artifacts, logger });
        results.push(result);
        await appendResult(artifacts.resultsPath, result);
      }
    } else {
      for (const stay of records) {
        const result = {
          stay,
          status: 'dry-run',
          submittedAt: new Date().toISOString(),
          message: 'Dry run only. No browser automation executed.'
        };
        results.push(result);
        await appendResult(artifacts.resultsPath, result);
      }
    }
  } finally {
    if (browserSession?.browser) {
      await browserSession.browser.close();
    }
  }

  const summary = {
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

  await writeSummary(artifacts.summaryPath, summary);
  await notifyRunSummary({
    webhookUrl: runtimeConfig.env.notifyWebhookUrl,
    summary,
    logger
  }).catch((error) => {
    logger.error({ err: error }, 'Failed to deliver webhook notification.');
  });

  logger.info({ summaryPath: artifacts.summaryPath }, 'Batch run completed.');
  return summary;
}

async function submitOneStay({ client, stay, artifacts, logger }) {
  try {
    const submission = await client.submitMissingStay(stay);
    return {
      stay,
      status: submission.status,
      submittedAt: new Date().toISOString(),
      message: submission.message
    };
  } catch (error) {
    logger.error({ err: error, stayId: stay.id }, 'Stay submission failed.');
    const screenshotPath = await client.captureFailureScreenshot(stay.id).catch(() => undefined);

    return {
      stay,
      status: 'failed',
      submittedAt: new Date().toISOString(),
      message: error.message,
      screenshotPath,
      runDir: artifacts.runDir
    };
  }
}

module.exports = {
  runBatch
};
