const Imap = require('imap');
const { simpleParser } = require('mailparser');
const { validateEmailConfig } = require('./config');
const { extractVerificationCode } = require('./verification-parser');

/**
 * @typedef {import('./config').EmailConnectionConfig} EmailConnectionConfig
 */

/**
 * @typedef {Object} SearchEmailsOptions
 * @property {string} [mailbox='INBOX'] Mailbox name to search.
 * @property {Array<string|Array<string>>} [criteria] Raw IMAP search criteria.
 * @property {string} [from] Sender filter.
 * @property {string} [to] Recipient filter.
 * @property {string} [subject] Subject filter.
 * @property {string} [body] Body filter.
 * @property {Date|string|number} [since] Lower bound for message date.
 * @property {Date|string|number} [before] Upper bound for message date.
 * @property {boolean} [unseen=false] Whether to only search unread messages.
 * @property {boolean} [markSeen=false] Whether fetched messages should be marked as read.
 * @property {number} [limit=10] Maximum number of messages to return.
 */

/**
 * @typedef {Object} ParsedEmail
 * @property {number|undefined} uid IMAP UID when available.
 * @property {number} sequenceNumber Message sequence number.
 * @property {Date|undefined} date Parsed sent date.
 * @property {string} subject Parsed subject line.
 * @property {string} from Sender summary text.
 * @property {string} to Recipient summary text.
 * @property {string} text Plain-text body.
 * @property {string|false|null} html HTML body.
 * @property {import('mailparser').ParsedMail['headers']} headers Parsed header map.
 */

/**
 * Sleep helper used for polling verification emails.
 *
 * @param {number} milliseconds Duration to wait.
 * @returns {Promise<void>}
 */
function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

/**
 * Formats a date value into the IMAP `DD-MMM-YYYY` format.
 *
 * @param {Date|string|number} value Input date value.
 * @returns {string}
 */
function formatImapDate(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid IMAP date value: ${value}`);
  }

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(date.getDate()).padStart(2, '0');

  return `${day}-${months[date.getMonth()]}-${date.getFullYear()}`;
}

/**
 * IMAP-backed email service for Gmail, Outlook, and generic providers.
 */
class EmailService {
  /**
   * @param {EmailConnectionConfig} config Email connection settings.
   */
  constructor(config) {
    this.config = validateEmailConfig(config);
    this.client = null;
  }

  /**
   * Opens the IMAP connection.
   *
   * @returns {Promise<EmailService>}
   */
  async connect() {
    if (this.client) {
      return this;
    }

    const client = new Imap({
      user: this.config.user,
      password: this.config.password,
      host: this.config.host,
      port: this.config.port,
      tls: this.config.tls,
      authTimeout: 10000,
      connTimeout: 10000
    });

    await new Promise((resolve, reject) => {
      const handleReady = () => {
        cleanup();
        this.client = client;
        resolve();
      };

      const handleError = (error) => {
        cleanup();
        reject(new Error(`Failed to connect to IMAP server: ${error.message}`));
      };

      const handleEnd = () => {
        cleanup();
        reject(new Error('IMAP connection ended before it became ready.'));
      };

      const cleanup = () => {
        client.removeListener('ready', handleReady);
        client.removeListener('error', handleError);
        client.removeListener('end', handleEnd);
      };

      client.once('ready', handleReady);
      client.once('error', handleError);
      client.once('end', handleEnd);
      client.on('close', () => {
        if (this.client === client) {
          this.client = null;
        }
      });
      client.on('end', () => {
        if (this.client === client) {
          this.client = null;
        }
      });

      try {
        client.connect();
      } catch (error) {
        cleanup();
        reject(new Error(`Unable to start IMAP connection: ${error.message}`));
      }
    });

    return this;
  }

  /**
   * Closes the IMAP connection.
   *
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (!this.client) {
      return;
    }

    const client = this.client;
    this.client = null;

    await new Promise((resolve) => {
      let settled = false;

      const finish = () => {
        if (settled) {
          return;
        }

        settled = true;
        client.removeListener('close', finish);
        client.removeListener('end', finish);
        client.removeListener('error', finish);
        resolve();
      };

      client.once('close', finish);
      client.once('end', finish);
      client.once('error', finish);

      try {
        client.end();
      } catch (_error) {
        finish();
      }
    });
  }

  /**
   * Searches and parses emails from the configured IMAP inbox.
   *
   * @param {SearchEmailsOptions} [options={}] Search options.
   * @returns {Promise<ParsedEmail[]>}
   */
  async searchEmails(options = {}) {
    const client = this.#requireConnection();
    const mailbox = options.mailbox || 'INBOX';
    const limit = Number.isFinite(options.limit) && options.limit > 0 ? Math.floor(options.limit) : 10;

    await this.#openBox(mailbox, !options.markSeen);

    const criteria = Array.isArray(options.criteria) && options.criteria.length > 0
      ? options.criteria
      : this.#buildSearchCriteria(options);
    const messageIds = await this.#search(criteria);

    if (messageIds.length === 0) {
      return [];
    }

    const limitedMessageIds = messageIds.slice(-limit);
    const messages = await this.#fetchMessages(limitedMessageIds, Boolean(options.markSeen));

    return messages.sort((left, right) => {
      const leftTime = left.date instanceof Date ? left.date.getTime() : 0;
      const rightTime = right.date instanceof Date ? right.date.getTime() : 0;
      return rightTime - leftTime;
    });
  }

  /**
   * Polls the inbox until a verification code is found or a timeout expires.
   *
   * @param {SearchEmailsOptions & {
   *   timeoutMs?: number,
   *   pollIntervalMs?: number,
   *   preferredLengths?: number[],
   *   throwIfNotFound?: boolean
   * }} [options={}] Search and polling options.
   * @returns {Promise<{code: string, matchedBy: string, email: ParsedEmail}|null>}
   */
  async getVerificationCode(options = {}) {
    const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(0, options.timeoutMs) : 60000;
    const pollIntervalMs = Number.isFinite(options.pollIntervalMs)
      ? Math.max(1000, options.pollIntervalMs)
      : 5000;
    const throwIfNotFound = Boolean(options.throwIfNotFound);
    const deadline = Date.now() + timeoutMs;
    const searchOptions = {
      mailbox: options.mailbox || 'INBOX',
      criteria: options.criteria,
      from: options.from,
      to: options.to,
      subject: options.subject,
      body: options.body,
      since: options.since || new Date(Date.now() - 15 * 60 * 1000),
      before: options.before,
      unseen: options.unseen,
      markSeen: options.markSeen,
      limit: options.limit || 10
    };

    do {
      const emails = await this.searchEmails(searchOptions);

      for (const email of emails) {
        const content = [email.subject, email.text, email.html || ''].filter(Boolean).join('\n');
        const match = extractVerificationCode(content, {
          preferredLengths: options.preferredLengths
        });

        if (match) {
          return {
            code: match.code,
            matchedBy: match.matchedBy,
            email
          };
        }
      }

      if (Date.now() >= deadline) {
        break;
      }

      await sleep(Math.min(pollIntervalMs, Math.max(0, deadline - Date.now())));
    } while (Date.now() <= deadline);

    if (throwIfNotFound) {
      throw new Error(`Verification code not found within ${timeoutMs}ms.`);
    }

    return null;
  }

  /**
   * Ensures the service has an active IMAP client.
   *
   * @returns {Imap}
   */
  #requireConnection() {
    if (!this.client) {
      throw new Error('Email service is not connected. Call connect() first.');
    }

    return this.client;
  }

  /**
   * Opens an IMAP mailbox.
   *
   * @param {string} mailbox Mailbox name.
   * @param {boolean} readOnly Whether the mailbox should be opened read-only.
   * @returns {Promise<unknown>}
   */
  async #openBox(mailbox, readOnly) {
    const client = this.#requireConnection();

    return new Promise((resolve, reject) => {
      client.openBox(mailbox, readOnly, (error, box) => {
        if (error) {
          reject(new Error(`Failed to open mailbox "${mailbox}": ${error.message}`));
          return;
        }

        resolve(box);
      });
    });
  }

  /**
   * Executes an IMAP search query.
   *
   * @param {Array<string|Array<string>>} criteria IMAP search criteria.
   * @returns {Promise<number[]>}
   */
  async #search(criteria) {
    const client = this.#requireConnection();

    return new Promise((resolve, reject) => {
      client.search(criteria, (error, results) => {
        if (error) {
          reject(new Error(`Email search failed: ${error.message}`));
          return;
        }

        resolve(Array.isArray(results) ? results : []);
      });
    });
  }

  /**
   * Fetches and parses raw messages returned by `imap.search`.
   *
   * @param {number[]} messageIds IMAP message identifiers.
   * @param {boolean} markSeen Whether fetched messages should be marked as read.
   * @returns {Promise<ParsedEmail[]>}
   */
  async #fetchMessages(messageIds, markSeen) {
    const client = this.#requireConnection();

    return new Promise((resolve, reject) => {
      const parsedMessages = [];
      const parseTasks = [];
      const fetchRequest = client.fetch(messageIds, {
        bodies: '',
        markSeen,
        struct: true
      });

      fetchRequest.on('message', (message, sequenceNumber) => {
        const chunks = [];
        let attributes = {};

        parseTasks.push(
          new Promise((resolveMessage, rejectMessage) => {
            message.on('body', (stream) => {
              stream.on('data', (chunk) => {
                chunks.push(chunk);
              });
            });

            message.once('attributes', (value) => {
              attributes = value || {};
            });

            message.once('end', async () => {
              try {
                const parsed = await simpleParser(Buffer.concat(chunks));
                const formattedMessage = {
                  uid: attributes.uid,
                  sequenceNumber,
                  date: parsed.date || undefined,
                  subject: parsed.subject || '',
                  from: parsed.from ? parsed.from.text : '',
                  to: parsed.to ? parsed.to.text : '',
                  text: parsed.text || '',
                  html: parsed.html || null,
                  headers: parsed.headers
                };

                parsedMessages.push(formattedMessage);
                resolveMessage();
              } catch (error) {
                rejectMessage(new Error(`Failed to parse email message: ${error.message}`));
              }
            });
          })
        );
      });

      fetchRequest.once('error', (error) => {
        reject(new Error(`Failed to fetch email messages: ${error.message}`));
      });

      fetchRequest.once('end', () => {
        Promise.all(parseTasks)
          .then(() => resolve(parsedMessages))
          .catch(reject);
      });
    });
  }

  /**
   * Builds IMAP search criteria from ergonomic search options.
   *
   * @param {SearchEmailsOptions} options Search options.
   * @returns {Array<string|Array<string>>}
   */
  #buildSearchCriteria(options) {
    const criteria = [];

    if (options.unseen) {
      criteria.push('UNSEEN');
    } else {
      criteria.push('ALL');
    }

    if (options.from) {
      criteria.push(['FROM', options.from]);
    }

    if (options.to) {
      criteria.push(['TO', options.to]);
    }

    if (options.subject) {
      criteria.push(['SUBJECT', options.subject]);
    }

    if (options.body) {
      criteria.push(['BODY', options.body]);
    }

    if (options.since) {
      criteria.push(['SINCE', formatImapDate(options.since)]);
    }

    if (options.before) {
      criteria.push(['BEFORE', formatImapDate(options.before)]);
    }

    return criteria;
  }
}

module.exports = {
  EmailService,
  formatImapDate
};
