const { z } = require('zod');

/**
 * Canonical IMAP provider presets.
 *
 * The `user` and `password` fields are intentionally left blank so callers can
 * inject credentials at runtime.
 *
 * @type {Readonly<Record<string, Readonly<EmailConnectionConfig>>>}
 */
const EMAIL_PROVIDER_TEMPLATES = Object.freeze({
  gmail: Object.freeze({
    host: 'imap.gmail.com',
    port: 993,
    user: '',
    password: '',
    tls: true
  }),
  outlook: Object.freeze({
    host: 'outlook.office365.com',
    port: 993,
    user: '',
    password: '',
    tls: true
  }),
  generic: Object.freeze({
    host: '',
    port: 993,
    user: '',
    password: '',
    tls: true
  })
});

const booleanSchema = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim().toLowerCase();

  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return value;
}, z.boolean());

const emailConfigSchema = z
  .object({
    host: z.string().trim().min(1, 'Email host is required.'),
    port: z.coerce.number().int().positive('Email port must be a positive integer.'),
    user: z.string().trim().min(1, 'Email user is required.'),
    password: z.string().min(1, 'Email password is required.'),
    tls: booleanSchema
  })
  .strict();

/**
 * @typedef {Object} EmailConnectionConfig
 * @property {string} host IMAP host name.
 * @property {number} port IMAP port number.
 * @property {string} user IMAP account username.
 * @property {string} password IMAP account password or app password.
 * @property {boolean} tls Whether the IMAP connection should use TLS.
 */

/**
 * Builds a concrete email configuration from a named provider preset.
 *
 * @param {'gmail'|'outlook'|'generic'} providerName Provider key.
 * @param {Partial<EmailConnectionConfig>} [overrides={}] Per-environment overrides.
 * @returns {EmailConnectionConfig}
 */
function createEmailConfig(providerName, overrides = {}) {
  const template = EMAIL_PROVIDER_TEMPLATES[providerName];

  if (!template) {
    throw new Error(`Unsupported email provider: ${providerName}`);
  }

  return validateEmailConfig({
    ...template,
    ...overrides
  });
}

/**
 * Validates and normalizes a raw email configuration object.
 *
 * @param {unknown} config Raw configuration value.
 * @returns {EmailConnectionConfig}
 */
function validateEmailConfig(config) {
  return emailConfigSchema.parse(config);
}

/**
 * Placeholder encrypted storage adapter for future secure persistence support.
 *
 * @example
 * const store = createEncryptedConfigStore();
 * await store.save('primary', config); // throws until implemented
 */
class EncryptedConfigStore {
  /**
   * Persists an email configuration by key.
   *
   * @param {string} key Storage key.
   * @param {EmailConnectionConfig} _config Config to persist.
   * @returns {Promise<never>}
   */
  async save(key, _config) {
    throw new Error(`Encrypted email config storage is not implemented. Cannot save key: ${key}`);
  }

  /**
   * Loads an email configuration by key.
   *
   * @param {string} key Storage key.
   * @returns {Promise<never>}
   */
  async load(key) {
    throw new Error(`Encrypted email config storage is not implemented. Cannot load key: ${key}`);
  }

  /**
   * Removes an email configuration by key.
   *
   * @param {string} key Storage key.
   * @returns {Promise<never>}
   */
  async remove(key) {
    throw new Error(`Encrypted email config storage is not implemented. Cannot remove key: ${key}`);
  }
}

/**
 * Creates the reserved encrypted config storage adapter.
 *
 * @returns {EncryptedConfigStore}
 */
function createEncryptedConfigStore() {
  return new EncryptedConfigStore();
}

module.exports = {
  EMAIL_PROVIDER_TEMPLATES,
  EncryptedConfigStore,
  createEmailConfig,
  createEncryptedConfigStore,
  validateEmailConfig
};
