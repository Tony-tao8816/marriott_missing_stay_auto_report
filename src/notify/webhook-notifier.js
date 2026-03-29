async function notifyRunSummary({ webhookUrl, summary, logger }) {
  if (!webhookUrl) {
    logger.debug('Webhook notification skipped because NOTIFY_WEBHOOK_URL is empty.');
    return { delivered: false, reason: 'webhook-disabled' };
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(summary)
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Webhook notification failed with ${response.status}: ${body}`);
  }

  return { delivered: true };
}

module.exports = {
  notifyRunSummary
};
