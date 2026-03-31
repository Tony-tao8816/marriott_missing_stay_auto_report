#!/usr/bin/env node

/**
 * 万豪注册测试脚本
 * 
 * 填写表单后暂停，供人工检查
 * 使用方式: npm run test-registration
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const { RyyAsiaService } = require('../email/ryyasia');
const dotenv = require('dotenv');
const readline = require('readline');

dotenv.config();
const execAsync = promisify(exec);

// 用户输入提示
function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

async function testRegistration() {
  console.log('🧪 万豪注册测试模式\n');
  console.log('==========================================\n');

  // PDF 账单信息
  const pdfData = {
    hotel: 'Rissai Valley, a Ritz-Carlton Reserve',
    guestName: 'Xie, Min',
    confirmationNumber: '88008405',
    arrivalDate: '2026-02-28',
    departureDate: '2026-03-03'
  };

  console.log('📄 PDF 账单信息:');
  console.log(`  酒店: ${pdfData.hotel}`);
  console.log(`  客人: ${pdfData.guestName}`);
  console.log(`  确认号: ${pdfData.confirmationNumber}`);
  console.log(`  入住: ${pdfData.arrivalDate}`);
  console.log(`  离店: ${pdfData.departureDate}\n`);

  // 解析姓名
  const [lastName, firstName] = pdfData.guestName.split(', ');
  console.log('📝 解析字段:');
  console.log(`  First Name: ${firstName}`);
  console.log(`  Last Name: ${lastName}\n`);

  // 生成其他字段
  const username = `${firstName.toLowerCase()}_${lastName.toLowerCase()}`;
  const email = `${username}@ryy.asia`;
  const password = `${lastName.charAt(0).toUpperCase()}${firstName.charAt(0).toLowerCase()}@marriott`;
  
  // 随机加州邮编
  const zipCode = Math.floor(Math.random() * (96162 - 90001 + 1)) + 90001;

  console.log('🔧 生成字段:');
  console.log(`  邮箱: ${email}`);
  console.log(`  密码: ${password}`);
  console.log(`  国家: United States`);
  console.log(`  ZIP: ${zipCode}\n`);

  console.log('==========================================\n');

  // 创建邮箱
  console.log('📧 Step 1: 创建 ryy.asia 邮箱...');
  const emailService = new RyyAsiaService({
    baseUrl: process.env.RYY_API_BASE_URL || 'https://ryy.asia',
    adminMailbox: process.env.RYY_ADMIN_MAILBOX,
    adminPassword: process.env.RYY_ADMIN_PASSWORD,
    domain: process.env.RYY_DOMAIN || 'ryy.asia'
  });

  try {
    await emailService.createMailbox(username, password);
    console.log(`✅ 邮箱创建成功: ${email}\n`);
  } catch (error) {
    console.log(`⚠️  邮箱可能已存在或创建失败: ${error.message}\n`);
  }

  // 启动浏览器（ headed 模式，可见窗口）
  console.log('🌐 Step 2: 启动浏览器（可见模式）...');
  console.log('   正在启动 ocbot...\n');
  
  try {
    await execAsync('ocbot start --headed', { timeout: 30000 });
    console.log('✅ 浏览器已启动\n');
  } catch (error) {
    console.log('⚠️  浏览器可能已启动或启动失败，继续...\n');
  }

  // 导航到注册页
  console.log('📍 Step 3: 导航到万豪注册页面...');
  const regUrl = 'https://www.marriott.com/loyalty/createAccount/createAccountPage1.mi';
  
  try {
    await execAsync(`ocbot navigate "${regUrl}"`, { timeout: 30000 });
    console.log('✅ 页面加载完成\n');
  } catch (error) {
    console.log(`❌ 导航失败: ${error.message}`);
    process.exit(1);
  }

  // 等待页面完全加载
  console.log('⏳ 等待页面加载...');
  await new Promise(r => setTimeout(r, 3000));

  // 填写表单
  console.log('\n📝 Step 4: 填写注册表单...\n');

  const fields = [
    { name: 'First Name', selector: '#firstNameToCreate', value: firstName },
    { name: 'Last Name', selector: '#lastNameToCreate', value: lastName },
    { name: 'ZIP Code', selector: '#postalCodeToCreate', value: zipCode.toString() },
    { name: 'Email', selector: '#emailToCreate', value: email },
    { name: 'Password', selector: '#passwordToCreate', value: password },
    { name: 'Confirm Password', selector: '#confirmPasswordToCreate', value: password }
  ];

  for (const field of fields) {
    try {
      await execAsync(`ocbot fill "${field.selector}" "${field.value}"`, { timeout: 10000 });
      console.log(`  ✅ ${field.name}: ${field.value}`);
      await new Promise(r => setTimeout(r, 500));
    } catch (error) {
      console.log(`  ❌ ${field.name}: 填写失败 - ${error.message}`);
    }
  }

  // 选择国家（USA）
  console.log('\n🌍 Step 5: 选择国家...');
  try {
    // 点击下拉框
    await execAsync('ocbot click "#countryToCreate"', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 1000));
    // 选择 USA
    await execAsync('ocbot click "option[value=\'US\']"', { timeout: 10000 });
    console.log('  ✅ Country: United States (US)\n');
  } catch (error) {
    console.log(`  ⚠️  国家选择可能失败: ${error.message}\n`);
  }

  // 截图保存
  console.log('📸 Step 6: 截图保存...');
  try {
    await execAsync('ocbot screenshot registration-test-filled.png', { timeout: 10000 });
    console.log('  ✅ 截图已保存: registration-test-filled.png\n');
  } catch (error) {
    console.log(`  ⚠️  截图失败: ${error.message}\n`);
  }

  // 暂停等待检查
  console.log('==========================================');
  console.log('🛑 表单已填写完成！');
  console.log('==========================================\n');
  console.log('📋 请检查浏览器窗口中的表单填写是否正确:\n');
  console.log(`  First Name: ${firstName}`);
  console.log(`  Last Name: ${lastName}`);
  console.log(`  Country: United States`);
  console.log(`  ZIP Code: ${zipCode}`);
  console.log(`  Email: ${email}`);
  console.log(`  Password: ${password}`);
  console.log(`  Confirm Password: ${password}\n`);
  console.log('==========================================\n');

  const answer = await prompt('检查无误后，输入 "yes" 继续提交，或按 Enter 退出: ');

  if (answer.toLowerCase() === 'yes') {
    console.log('\n📝 正在提交注册...');
    try {
      await execAsync('ocbot click "button[type=submit]"', { timeout: 10000 });
      console.log('✅ 注册已提交！');
      console.log('\n请检查浏览器中的注册结果。');
    } catch (error) {
      console.log(`❌ 提交失败: ${error.message}`);
    }
  } else {
    console.log('\n👋 测试已取消，浏览器保持打开状态供您检查。');
    console.log('手动关闭浏览器窗口。');
  }

  process.exit(0);
}

// 运行测试
testRegistration().catch(error => {
  console.error('\n❌ 测试失败:', error.message);
  process.exit(1);
});
