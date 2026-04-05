class CloudMailClient {
  constructor({ baseUrl }) {
    if (!baseUrl) {
      throw new Error('Missing required option: mail API base URL');
    }

    this.baseUrl = normalizeBaseUrl(baseUrl);
  }

  async genToken({ email, password }) {
    const payload = await this.request('POST', '/genToken', {
      body: {
        email,
        password
      }
    });

    return payload.token;
  }

  async listAccounts({ token, size = 100, accountId = 0, lastSort = 9999999999 }) {
    return this.request(
      'GET',
      `/account/list?size=${encodeURIComponent(size)}&accountId=${encodeURIComponent(accountId)}&lastSort=${encodeURIComponent(lastSort)}`,
      { token }
    );
  }

  async addAccount({ token, email }) {
    return this.request('POST', '/account/add', {
      token,
      body: {
        email
      }
    });
  }

  async setAccountName({ token, accountId, name }) {
    return this.request('PUT', '/account/setName', {
      token,
      body: {
        accountId,
        name
      }
    });
  }

  async sendEmail({ token, sendEmail, sendName, receiveEmail, subject, content, text }) {
    return this.request('POST', '/sendEmail', {
      token,
      body: {
        sendEmail,
        sendName,
        receiveEmail,
        subject,
        content,
        text
      }
    });
  }

  async request(method, endpoint, { token, body } = {}) {
    const headers = {
      Accept: 'application/json'
    };

    if (token) {
      headers.Authorization = token;
    }

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });

    const responseText = await response.text();
    let payload = null;

    if (responseText) {
      try {
        payload = JSON.parse(responseText);
      } catch (error) {
        throw new Error(
          `Cloud Mail ${method} ${endpoint} returned non-JSON content: ${responseText.slice(0, 200)}`
        );
      }
    }

    if (!response.ok) {
      throw new Error(
        `Cloud Mail ${method} ${endpoint} failed with HTTP ${response.status}: ${payload?.message || response.statusText}`
      );
    }

    if (!payload || payload.code !== 200) {
      throw new Error(
        `Cloud Mail ${method} ${endpoint} failed: ${payload?.message || 'Unknown API error'}`
      );
    }

    return payload.data;
  }
}

function normalizeBaseUrl(baseUrl) {
  const trimmed = String(baseUrl).trim().replace(/\/+$/, '');

  if (trimmed.endsWith('/api/public')) {
    return trimmed;
  }

  return `${trimmed}/api/public`;
}

module.exports = {
  CloudMailClient
};
