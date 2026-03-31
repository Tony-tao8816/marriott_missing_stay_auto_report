/**
 * 万豪缺失住宿记录补登自动化
 * 
 * 使用 agent-browser 提交补登申请
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class MarriottMissingStay {
  /**
   * @param {Object} config
   * @param {string} config.email - 万豪账户邮箱
   * @param {string} config.password - 万豪账户密码
   */
  constructor(config) {
    this.email = config.email;
    this.password = config.password;
    this.baseUrl = 'https://www.marriott.com';
  }

  /**
   * 执行 agent-browser 命令
   * @param {string} command - 命令
   */
  async execBrowser(command) {
    const fullCommand = `agent-browser --auto-connect ${command}`;
    try {
      const { stdout } = await execAsync(fullCommand, { timeout: 30000 });
      return { success: true, output: stdout };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 登录万豪账户
   */
  async login() {
    console.log('🔐 登录万豪账户...');
    
    // 打开登录页
    await this.execBrowser(`open "${this.baseUrl}/loyalty/login/login.mi"`);
    await this.sleep(3000);
    
    // 填写邮箱
    console.log('  填写邮箱...');
    await this.execBrowser(`fill '[name="username"], #username, input[type="email"]' "${this.email}"`);
    await this.sleep(500);
    
    // 填写密码
    console.log('  填写密码...');
    await this.execBrowser(`fill '[name="password"], #password, input[type="password"]' "${this.password}"`);
    await this.sleep(500);
    
    // 点击登录
    console.log('  点击登录...');
    await this.execBrowser('click "button[type=submit], button:has-text(\"Sign In\"), button:has-text(\"Login\")"');
    await this.sleep(5000);
    
    console.log('✅ 登录完成');
    return { success: true };
  }

  /**
   * 导航到补登页面
   */
  async navigateToMissingStay() {
    console.log('📍 导航到补登页面...');
    
    const missingStayUrl = `${this.baseUrl}/loyalty/myAccount/missingStayRequest.mi`;
    await this.execBrowser(`open "${missingStayUrl}"`);
    await this.sleep(5000);
    
    console.log('✅ 已打开补登页面');
    return { success: true };
  }

  /**
   * 填写补登表单
   * @param {Object} data
   * @param {string} data.hotelName - 酒店名称
   * @param {string} data.checkInDate - 入住日期 (YYYY-MM-DD)
   * @param {string} data.checkOutDate - 离店日期 (YYYY-MM-DD)
   * @param {string} data.confirmationNumber - 确认号
   * @param {string} [data.roomNumber] - 房号（可选）
   */
  async fillMissingStayForm(data) {
    console.log('📝 填写补登表单...');
    
    // 转换日期格式 (YYYY-MM-DD -> MM/DD/YYYY)
    const formatDate = (dateStr) => {
      const [year, month, day] = dateStr.split('-');
      return `${month}/${day}/${year}`;
    };
    
    const checkInFormatted = formatDate(data.checkInDate);
    const checkOutFormatted = formatDate(data.checkOutDate);
    
    // 填写酒店名称
    console.log(`  酒店: ${data.hotelName}`);
    await this.execBrowser(`fill '[name*="hotel" i], [placeholder*="hotel" i], #hotelName' "${data.hotelName}"`);
    await this.sleep(500);
    
    // 填写入住日期
    console.log(`  入住日期: ${checkInFormatted}`);
    await this.execBrowser(`fill '[name*="checkIn" i], [name*="arrival" i], #checkInDate' "${checkInFormatted}"`);
    await this.sleep(500);
    
    // 填写离店日期
    console.log(`  离店日期: ${checkOutFormatted}`);
    await this.execBrowser(`fill '[name*="checkOut" i], [name*="departure" i], #checkOutDate' "${checkOutFormatted}"`);
    await this.sleep(500);
    
    // 填写确认号
    console.log(`  确认号: ${data.confirmationNumber}`);
    await this.execBrowser(`fill '[name*="confirmation" i], [name*="conf" i], #confirmationNumber' "${data.confirmationNumber}"`);
    await this.sleep(500);
    
    // 填写房号（如果有）
    if (data.roomNumber) {
      console.log(`  房号: ${data.roomNumber}`);
      await this.execBrowser(`fill '[name*="room" i], #roomNumber' "${data.roomNumber}"`);
      await this.sleep(500);
    }
    
    console.log('✅ 表单填写完成');
    return { success: true };
  }

  /**
   * 上传账单附件
   * @param {string} pdfPath - PDF 文件路径
   */
  async uploadFolio(pdfPath) {
    console.log('📎 上传账单附件...');
    console.log(`  文件: ${pdfPath}`);
    
    // 点击上传按钮
    await this.execBrowser('click "input[type=file], [name*=\"file\" i], button:has-text(\"Upload\")"');
    await this.sleep(2000);
    
    // 使用 set-input-files 上传
    await this.execBrowser(`set-input-files "input[type=file]" "${pdfPath}"`);
    await this.sleep(3000);
    
    console.log('✅ 文件已上传');
    return { success: true };
  }

  /**
   * 提交补登申请
   */
  async submitForm() {
    console.log('📝 提交补登申请...');
    
    // 点击提交按钮
    await this.execBrowser('click "button[type=submit], button:has-text(\"Submit\"), button:has-text(\"Request\"), #submitBtn"');
    await this.sleep(5000);
    
    console.log('✅ 申请已提交');
    return { success: true };
  }

  /**
   * 完整的补登提交流程
   * @param {Object} stayData
   */
  async submit(stayData) {
    const result = {
      success: false,
      steps: [],
      confirmation: null
    };

    try {
      // 1. 登录
      await this.login();
      result.steps.push({ step: 'login', status: 'success' });

      // 2. 导航到补登页面
      await this.navigateToMissingStay();
      result.steps.push({ step: 'navigate', status: 'success' });

      // 3. 填写表单
      await this.fillMissingStayForm(stayData);
      result.steps.push({ step: 'fill_form', status: 'success' });

      // 4. 上传账单（如果有）
      if (stayData.folioPdfPath) {
        await this.uploadFolio(stayData.folioPdfPath);
        result.steps.push({ step: 'upload', status: 'success' });
      }

      // 5. 提交（暂不真正提交，等用户确认）
      console.log('\n🛑 表单已准备好，等待确认...');
      console.log('请检查浏览器中的表单填写是否正确。');
      console.log('确认无误后，手动点击提交按钮，或告诉我"提交"。\n');

      result.success = true;
      result.steps.push({ step: 'ready', status: 'waiting_for_confirmation' });

    } catch (error) {
      result.steps.push({ step: 'error', status: 'failed', error: error.message });
      console.error('❌ 补登流程失败:', error.message);
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
  MarriottMissingStay
};
