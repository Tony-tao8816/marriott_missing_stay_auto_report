const { exec } = require('child_process');
const { promisify } = require('util');
const { RyyAsiaService } = require('../../email/ryyasia');
const { createLogger } = require('../../utils/logger');

const execAsync = promisify(exec);

/**
 * 万豪会员注册自动化
 * 
 * 使用 ocbot CLI 完成注册流程
 */
class MarriottRegistration {
  /**
   * @param {Object} config
   * @param {string} config.ocbotPath - ocbot CLI 路径
   * @param {Object} config.ryyAsiaConfig - ryy.asia 配置
   * @param {string} config.headless - 是否无头模式
   */
  constructor(config) {
    this.ocbotPath = config.ocbotPath || 'ocbot';
    this.headless = config.headless !== false;
    this.logger = createLogger('info');
    
    // 初始化 ryy.asia 服务
    if (config.ryyAsiaConfig) {
      this.emailService = new RyyAsiaService(config.ryyAsiaConfig);
    }
    
    // 注册页面 URL
    this.registrationUrl = 'https://www.marriott.com/loyalty/createAccount/createAccountPage1.mi';
  }

  /**
   * 执行 ocbot 命令
   * @param {string} command - 命令
   * @returns {Promise<Object>}
   */
  async execOcbot(command) {
    const fullCommand = `${this.ocbotPath} ${command}`;
    this.logger.info(`Executing: ${fullCommand}`);
    
    try {
      const { stdout, stderr } = await execAsync(fullCommand, { timeout: 60000 });
      
      if (stderr && stderr.includes('error')) {
        throw new Error(stderr);
      }
      
      // 尝试解析 JSON 输出
      try {
        return JSON.parse(stdout);
      } catch {
        return { success: true, output: stdout.trim() };
      }
    } catch (error) {
      this.logger.error(`Command failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 启动浏览器
   */
  async startBrowser() {
    const headlessFlag = this.headless ? '--headless' : '';
    return await this.execOcbot(`start ${headlessFlag}`);
  }

  /**
   * 导航到注册页面
   */
  async navigateToRegistration() {
    return await this.execOcbot(`navigate "${this.registrationUrl}"`);
  }

  /**
   * 填写注册表单
   * @param {Object} data
   * @param {string} data.firstName - 名
   * @param {string} data.lastName - 姓
   * @param {string} data.email - 邮箱
   * @param {string} data.password - 密码
   * @param {string} data.country - 国家代码
   * @param {string} data.zipCode - 邮政编码
   */
  async fillRegistrationForm(data) {
    const { firstName, lastName, email, password, country, zipCode } = data;
    
    // 填写名字
    await this.execOcbot(`fill "#firstNameToCreate" "${firstName}"`);
    await this.execOcbot(`fill "#lastNameToCreate" "${lastName}"`);
    
    // 选择国家
    await this.selectCountry(country);
    
    // 填写邮编
    await this.execOcbot(`fill "#postalCodeToCreate" "${zipCode}"`);
    
    // 填写邮箱
    await this.execOcbot(`fill "#emailToCreate" "${email}"`);
    
    // 填写密码
    await this.execOcbot(`fill "#passwordToCreate" "${password}"`);
    await this.execOcbot(`fill "#confirmPasswordToCreate" "${password}"`);
    
    return { success: true, message: 'Form filled' };
  }

  /**
   * 选择国家
   * @param {string} countryCode - 国家代码 (如 'CN', 'US')
   */
  async selectCountry(countryCode) {
    // 点击国家下拉框
    await this.execOcbot(`click "#countryToCreate"`);
    // 等待下拉菜单
    await this.sleep(500);
    // 选择国家
    await this.execOcbot(`click "option[value='${countryCode}']"`);
    return { success: true };
  }

  /**
   * 提交注册表单
   */
  async submitRegistration() {
    // 截图保存表单状态
    await this.execOcbot('screenshot registration-form.png');
    
    // 点击提交按钮
    return await this.execOcbot('click "button[type=submit]"');
  }

  /**
   * 获取邮箱验证码
   * @param {string} email - 邮箱地址
   * @param {number} timeoutMs - 超时时间
   */
  async getVerificationCode(email, timeoutMs = 120000) {
    if (!this.emailService) {
      throw new Error('Email service not configured');
    }
    
    this.logger.info(`Waiting for verification email at ${email}...`);
    
    const result = await this.emailService.getVerificationCode({
      email,
      from: 'marriott',
      subject: 'verify',
      timeoutMs,
      pollIntervalMs: 5000
    });
    
    if (!result) {
      throw new Error('Verification code not received within timeout');
    }
    
    this.logger.info(`Verification code received: ${result.code}`);
    return result.code;
  }

  /**
   * 完成邮箱验证
   * @param {string} code - 验证码
   */
  async verifyEmail(code) {
    // 填写验证码
    await this.execOcbot(`fill "#verificationCode" "${code}"`);
    // 提交验证
    return await this.execOcbot('click "button.verify-button"');
  }

  /**
   * 生成密码
   * 格式: Lastname首字母大写 + Firstname首字母小写 + @marriott
   * 示例: Xie Min -> Xm@marriott
   * @param {string} firstName
   * @param {string} lastName
   * @returns {string}
   */
  generatePassword(firstName, lastName) {
    const firstInitial = firstName.charAt(0).toLowerCase();
    const lastInitial = lastName.charAt(0).toUpperCase();
    return `${lastInitial}${firstInitial}@marriott`;
  }

  /**
   * 获取随机美国邮编
   * 加州: 90001-96162
   * 华盛顿州: 98001-99403
   * @returns {string}
   */
  getRandomUSZipCode() {
    // 随机选择州: 0=加州, 1=华盛顿州
    const state = Math.random() < 0.5 ? 'CA' : 'WA';
    let zip;
    
    if (state === 'CA') {
      // 加州邮编范围
      zip = Math.floor(Math.random() * (96162 - 90001 + 1)) + 90001;
    } else {
      // 华盛顿州邮编范围
      zip = Math.floor(Math.random() * (99403 - 98001 + 1)) + 98001;
    }
    
    return zip.toString();
  }

  /**
   * 完整的注册流程
   * @param {Object} userData
   * @param {string} userData.firstName
   * @param {string} userData.lastName
   * @param {string} [userData.country] - 国家代码 (默认 'US')
   * @param {string} [userData.zipCode] - 邮政编码 (默认随机加州/华盛顿)
   */
  async register(userData) {
    const startTime = Date.now();
    
    // 自动生成密码
    const password = this.generatePassword(userData.firstName, userData.lastName);
    
    // 使用随机邮编或用户指定
    const zipCode = userData.zipCode || this.getRandomUSZipCode();
    const country = userData.country || 'US';
    
    const result = {
      success: false,
      email: null,
      password: password,
      country: country,
      zipCode: zipCode,
      duration: 0,
      steps: []
    };

    try {
      // 1. 创建邮箱
      this.logger.info('Step 1: Creating email account...');
      const username = `marriott${Date.now()}`;
      const email = `${username}@ryy.asia`;
      
      if (this.emailService) {
        await this.emailService.createMailbox(username, userData.password);
      }
      result.email = email;
      result.steps.push({ step: 'create_email', status: 'success', email });

      // 2. 启动浏览器
      this.logger.info('Step 2: Starting browser...');
      await this.startBrowser();
      result.steps.push({ step: 'start_browser', status: 'success' });

      // 3. 导航到注册页
      this.logger.info('Step 3: Navigating to registration page...');
      await this.navigateToRegistration();
      result.steps.push({ step: 'navigate', status: 'success' });

      // 4. 填写表单
      this.logger.info('Step 4: Filling registration form...');
      this.logger.info(`  Password: ${password}`);
      this.logger.info(`  Country: ${country}, ZIP: ${zipCode}`);
      await this.fillRegistrationForm({
        firstName: userData.firstName,
        lastName: userData.lastName,
        email,
        password: password,
        country: country,
        zipCode: zipCode
      });
      result.steps.push({ step: 'fill_form', status: 'success', password, country, zipCode });

      // 5. 提交注册
      this.logger.info('Step 5: Submitting registration...');
      await this.submitRegistration();
      result.steps.push({ step: 'submit', status: 'success' });

      // 6. 等待并获取验证码
      this.logger.info('Step 6: Waiting for verification code...');
      const code = await this.getVerificationCode(email);
      result.steps.push({ step: 'get_code', status: 'success', code });

      // 7. 完成验证
      this.logger.info('Step 7: Verifying email...');
      await this.verifyEmail(code);
      result.steps.push({ step: 'verify', status: 'success' });

      // 8. 截图保存结果
      await this.execOcbot('screenshot registration-success.png');

      result.success = true;
      result.duration = Date.now() - startTime;
      
      this.logger.info(`Registration completed in ${result.duration}ms`);
      
    } catch (error) {
      result.steps.push({ step: 'error', status: 'failed', error: error.message });
      this.logger.error(`Registration failed: ${error.message}`);
      
      // 截图保存错误状态
      await this.execOcbot('screenshot registration-error.png').catch(() => {});
      
      throw error;
    }

    return result;
  }

  /**
   * 睡眠等待
   * @param {number} ms
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = {
  MarriottRegistration
};
