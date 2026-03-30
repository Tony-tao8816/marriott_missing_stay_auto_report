const axios = require('axios');

/**
 * Ryy.asia 邮箱服务 API 客户端
 * 
 * 提供生成 Token、添加用户、查询邮件等功能
 */
class RyyAsiaClient {
  /**
   * @param {Object} config
   * @param {string} config.baseUrl - API 基础 URL, 例如: https://ryy.asia
   * @param {string} config.adminMailbox - 管理员邮箱
   * @param {string} config.adminPassword - 管理员密码
   */
  constructor(config) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.adminMailbox = config.adminMailbox;
    this.adminPassword = config.adminPassword;
    this.token = null;
  }

  /**
   * 生成身份令牌
   * @returns {Promise<string>} token
   */
  async genToken() {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/public/genToken`,
        {
          mailbox: this.adminMailbox,
          password: this.adminPassword
        },
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );

      if (response.data && response.data.token) {
        this.token = response.data.token;
        return this.token;
      }

      throw new Error(`生成 Token 失败: ${JSON.stringify(response.data)}`);
    } catch (error) {
      if (error.response) {
        throw new Error(`生成 Token 失败: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw new Error(`生成 Token 失败: ${error.message}`);
    }
  }

  /**
   * 确保 Token 有效
   */
  async ensureToken() {
    if (!this.token) {
      await this.genToken();
    }
  }

  /**
   * 添加用户 (创建邮箱账号)
   * @param {Object} userData
   * @param {string} userData.user - 用户名 (不含域名)
   * @param {string} userData.password - 用户密码
   * @returns {Promise<Object>} 创建结果
   */
  async addUser(userData) {
    await this.ensureToken();

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/public/addUser`,
        {
          user: userData.user,
          password: userData.password
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`
          }
        }
      );

      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`添加用户失败: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw new Error(`添加用户失败: ${error.message}`);
    }
  }

  /**
   * 查询邮件列表
   * @param {Object} params
   * @param {string} params.to - 收件人邮箱 (完整地址)
   * @param {number} [params.limit=10] - 返回数量限制
   * @returns {Promise<Array>} 邮件列表
   */
  async emailList(params) {
    await this.ensureToken();

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/public/emailList`,
        {
          to: params.to,
          limit: params.limit || 10
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`
          }
        }
      );

      return response.data || [];
    } catch (error) {
      if (error.response) {
        throw new Error(`查询邮件失败: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw new Error(`查询邮件失败: ${error.message}`);
    }
  }
}

module.exports = {
  RyyAsiaClient
};
