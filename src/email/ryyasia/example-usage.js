/**
 * Ryy.asia 邮箱服务使用示例
 * 
 * 流程：
 * 1. 创建邮箱账号
 * 2. 等待邮件
 * 3. 提取验证码
 */

const { RyyAsiaService } = require('./index');

async function main() {
  // 配置 (实际使用时从环境变量读取)
  const config = {
    baseUrl: process.env.RYY_API_BASE_URL || 'https://ryy.asia',
    adminMailbox: process.env.RYY_ADMIN_MAILBOX,
    adminPassword: process.env.RYY_ADMIN_PASSWORD,
    domain: process.env.RYY_DOMAIN || 'ryy.asia'
  };

  if (!config.adminMailbox || !config.adminPassword) {
    console.error('错误: 请设置 RYY_ADMIN_MAILBOX 和 RYY_ADMIN_PASSWORD 环境变量');
    process.exit(1);
  }

  const service = new RyyAsiaService(config);

  try {
    // 1. 创建邮箱账号
    const username = `test${Date.now()}`;
    const password = `Pass${Math.random().toString(36).slice(2, 10)}`;
    
    console.log(`创建邮箱账号: ${username}@${config.domain}`);
    const mailbox = await service.createMailbox(username, password);
    console.log('创建成功:', mailbox);

    // 2. 等待并获取验证码
    console.log('等待万豪验证码邮件...');
    const result = await service.getVerificationCode({
      email: mailbox.email,
      from: 'marriott',  // 过滤发件人
      subject: 'verification',  // 过滤主题
      timeoutMs: 60000,  // 轮询 60 秒
      pollIntervalMs: 5000  // 每 5 秒检查一次
    });

    if (result) {
      console.log(`验证码: ${result.code}`);
      console.log(`匹配规则: ${result.matchedBy}`);
    } else {
      console.log('未找到验证码');
    }

  } catch (error) {
    console.error('错误:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
