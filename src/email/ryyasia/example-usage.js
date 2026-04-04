/**
 * Ryy.asia 邮箱服务使用示例
 * 
 * 流程：
 * 1. 创建邮箱账号
 * 2. 查询邮件列表
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

    // 2. 查询邮件列表
    console.log('查询邮箱中的邮件...');
    const emails = await service.listEmails({
      email: mailbox.email,
      size: 10
    });

    console.log(`邮件数量: ${emails.length}`);
    console.log('最新邮件:', emails[0] || null);

  } catch (error) {
    console.error('错误:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
