const { RyyAsiaApiClient } = require('./ryyasia-api-client');

class RyyAsiaApiEmailService {
  constructor(config) {
    this.client = new RyyAsiaApiClient(config);
    this.domain = config.domain;
  }

  async createMailbox(username, password) {
    return this.client.createMailbox({
      username,
      password,
      domain: this.domain
    });
  }

  async listEmails(options = {}) {
    return this.client.listEmails({
      toEmail: options.email || options.toEmail,
      sendEmail: options.from || options.sendEmail,
      subject: options.subject,
      content: options.content,
      type: options.type,
      num: options.num,
      size: options.size
    });
  }
}

module.exports = {
  RyyAsiaApiEmailService
};
