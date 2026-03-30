const { RyyAsiaClient } = require('./ryyasia-client');
const { extractVerificationCode } = require('../verification-parser');

/**
 * Ryy.asia 邮箱服务
 * 
 * 整合 API 客户端和验证码提取功能
 */
class RyyAsiaService {
  /**
   * @param {Object} config
   * @param {string} config.baseUrl - API 基础 URL
   * @param {string} config.adminMailbox - 管理员邮箱
   * @param {string} config.adminPassword - 管理员密码
   * @param {string} config.domain - 邮箱域名, 例如: ryy.asia
   */
  constructor(config) {
    this.client = new RyyAsiaClient({
      baseUrl: config.baseUrl,
      adminMailbox: config.adminMailbox,
      adminPassword: config.adminPassword
    });
    this.domain = config.domain;
  }

  /**
   * 创建邮箱账号
   * @param {string} username - 用户名 (不含域名)
   * @param {string} password - 密码
   * @returns {Promise<Object>} { user, email, password }
   */
  async createMailbox(username, password) {
    const email = `${username}@${this.domain}`;
    const result = await this.client.addUser({
      email: email,
      password: password
    });

    return {
      user: username,
      email: email,
      password: password,
      raw: result
    };
  }

  /**
   * 获取邮箱中的最新邮件
   * @param {string} email - 完整邮箱地址
   * @param {number} [size=20] - 每页数量
   * @returns {Promise<Array>} 邮件列表
   */
  async getEmails(email, size = 20) {
    return await this.client.emailList({
      toEmail: email,
      type: 0,
      num: 1,
      size: size
    });
  }

  /**
   * 轮询获取验证码
   * @param {Object} options
   * @param {string} options.email - 邮箱地址
   * @param {string} [options.from] - 发件人过滤
   * @param {string} [options.subject] - 主题过滤
   * @param {number} [options.timeoutMs=60000] - 超时时间 (毫秒)
   * @param {number} [options.pollIntervalMs=5000] - 轮询间隔 (毫秒)
   * @returns {Promise<Object|null>} { code, matchedBy, email }
   */
  async getVerificationCode(options) {
    const { email, from, subject, timeoutMs = 60000, pollIntervalMs = 5000 } = options;
    const deadline = Date.now() + timeoutMs;

    do {
      const emails = await this.getEmails(email, 10);

      for (const mail of emails) {
        // 过滤发件人
        if (from && !mail.from?.includes(from)) {
          continue;
        }

        // 过滤主题
        if (subject && !mail.subject?.includes(subject)) {
          continue;
        }

        // 提取验证码
        const content = [mail.subject, mail.content, mail.text].filter(Boolean).join('\n');
        const match = extractVerificationCode(content);

        if (match) {
          return {
            code: match.code,
            matchedBy: match.matchedBy,
            email: mail
          };
        }
      }

      if (Date.now() >= deadline) {
        break;
      }

      await sleep(Math.min(pollIntervalMs, Math.max(0, deadline - Date.now())));
    } while (Date.now() <= deadline);

    return null;
  }
}

/**
 * 睡眠辅助函数
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  RyyAsiaService
};
