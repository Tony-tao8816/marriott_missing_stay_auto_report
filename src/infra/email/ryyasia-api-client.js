const axios = require('axios');

class RyyAsiaApiClient {
  constructor(config) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.adminMailbox = config.adminMailbox;
    this.adminPassword = config.adminPassword;
    this.token = null;
  }

  async createMailbox({ username, password, domain }) {
    await this.#ensureToken();

    const email = `${username}@${domain}`;
    const response = await axios.post(
      `${this.baseUrl}/api/public/addUser`,
      {
        list: [
          {
            email,
            password
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.token
        }
      }
    );

    this.#assertBusinessSuccess(response.data, 'Create mailbox');
    return {
      email,
      username,
      password,
      raw: response.data
    };
  }

  async listEmails(params) {
    await this.#ensureToken();

    const response = await axios.post(
      `${this.baseUrl}/api/public/emailList`,
      {
        toEmail: params.toEmail,
        sendEmail: params.sendEmail,
        subject: params.subject,
        content: params.content,
        type: params.type ?? 0,
        num: params.num ?? 1,
        size: params.size ?? 20
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.token
        }
      }
    );

    this.#assertBusinessSuccess(response.data, 'List emails');
    return response.data?.data?.list || [];
  }

  async #ensureToken() {
    if (this.token) {
      return;
    }

    const response = await axios.post(
      `${this.baseUrl}/api/public/genToken`,
      {
        email: this.adminMailbox,
        password: this.adminPassword
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    this.#assertBusinessSuccess(response.data, 'Generate token');
    const token = response.data?.data?.token;
    if (!token) {
      throw new Error('Generate token failed: response did not include a token.');
    }

    this.token = token;
  }

  #assertBusinessSuccess(data, action) {
    if (data?.code === 200) {
      return;
    }

    throw new Error(`${action} failed: ${JSON.stringify(data)}`);
  }
}

module.exports = {
  RyyAsiaApiClient
};
