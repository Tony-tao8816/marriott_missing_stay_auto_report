const {
  EMAIL_PROVIDER_TEMPLATES,
  EncryptedConfigStore,
  createEmailConfig,
  createEncryptedConfigStore,
  validateEmailConfig
} = require('./config');
const { EmailService, formatImapDate } = require('./email-service');
const {
  extractVerificationCode,
  extractVerificationCodes,
  normalizeEmailContent
} = require('./verification-parser');

module.exports = {
  EMAIL_PROVIDER_TEMPLATES,
  EncryptedConfigStore,
  EmailService,
  createEmailConfig,
  createEncryptedConfigStore,
  extractVerificationCode,
  extractVerificationCodes,
  formatImapDate,
  normalizeEmailContent,
  validateEmailConfig
};
