const { EmailService, createEmailConfig } = require('./index');

/**
 * Example usage for retrieving a Marriott verification code from Gmail.
 *
 * Configure `EMAIL_USER` and `EMAIL_PASSWORD` before executing this file.
 */
async function main() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    throw new Error('EMAIL_USER and EMAIL_PASSWORD must be set before running the example.');
  }

  const config = createEmailConfig('gmail', {
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD
  });
  const emailService = new EmailService(config);

  try {
    await emailService.connect();

    const result = await emailService.getVerificationCode({
      from: 'no-reply@marriott.com',
      subject: 'verification',
      unseen: true,
      timeoutMs: 30000,
      pollIntervalMs: 5000
    });

    if (!result) {
      process.stdout.write('No verification code email found within the timeout window.\n');
      return;
    }

    process.stdout.write(
      `Verification code: ${result.code} (subject: ${result.email.subject || 'n/a'})\n`
    );
  } finally {
    await emailService.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Email example failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  main
};
