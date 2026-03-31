#!/usr/bin/env node

/**
 * 万豪注册测试脚本
 * 
 * 填写表单后暂停，供人工检查
 * 使用方式: npm run test-registration
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const { RyyAsiaService } = require('../../email/ryyasia');
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
  
  // 尝试多个可能的 ocbot 路径
  const ocbotPaths = [
    'ocbot',
    '/Applications/Ocbot.app/Contents/MacOS/ocbot',
    '/usr/local/bin/ocbot',
    '/opt/homebrew/bin/ocbot',
    process.env.OCBOT_PATH
  ].filter(Boolean);
  
  let ocbotCmd = null;
  for (const path of ocbotPaths) {
    try {
      await execAsync(`${path} --version`, { timeout: 5000 });
      ocbotCmd = path;
      console.log(`   找到 ocbot: ${path}\n`);
      break;
    } catch {
      continue;
    }
  }
  
  if (!ocbotCmd) {
    console.log('❌ 未找到 ocbot，请确保已安装 ocbot.app');
    console.log('   下载地址: https://oc.bot\n');
    process.exit(1);
  }
  
  try {
    await execAsync(`${ocbotCmd} start --headed`, { timeout: 30000 });
    console.log('✅ 浏览器已启动\n');
  } catch (error) {
    console.log('⚠️  浏览器可能已启动或启动失败，继续...\n');
  }

  // 导航到注册页
  console.log('📍 Step 3: 导航到万豪注册页面...');
  const regUrl = 'https://www.marriott.com/loyalty/createAccount/createAccountPage1.mi';
  
  try {
    await execAsync(`${ocbotCmd} navigate "${regUrl}"`, { timeout: 30000 });
    console.log('✅ 页面加载完成\n');
  } catch (error) {
    console.log(`❌ 导航失败: ${error.message}`);
    process.exit(1);
  }

  // 等待页面完全加载
  console.log('⏳ 等待页面加载...');
  await new Promise(r => setTimeout(r, 3000));

  // 填写表单 - 使用 JavaScript 注入方式
  console.log('\n📝 Step 4: 填写注册表单 (JavaScript 注入)...\n');

  // 构建 JavaScript 代码来填写表单
  const fillScript = `
    (function() {
      // First Name
      const fn = document.querySelector('[name="input-text-First Name"]');
      if (fn) { fn.value = '${firstName}'; fn.dispatchEvent(new Event('input', { bubbles: true })); }
      
      // Last Name
      const ln = document.querySelector('[name="input-text-Last Name"]');
      if (ln) { ln.value = '${lastName}'; ln.dispatchEvent(new Event('input', { bubbles: true })); }
      
      // ZIP
      const zip = document.querySelector('[name="input-text-Zip/Postal Code"]');
      if (zip) { zip.value = '${zipCode}'; zip.dispatchEvent(new Event('input', { bubbles: true })); }
      
      // Email
      const em = document.querySelector('[name="input-text-Email"]');
      if (em) { em.value = '${email}'; em.dispatchEvent(new Event('input', { bubbles: true })); }
      
      // Password
      const pw = document.querySelector('#password');
      if (pw) { pw.value = '${password}'; pw.dispatchEvent(new Event('input', { bubbles: true })); }
      
      // Confirm Password
      const cpw = document.querySelector('#confirmPassword');
      if (cpw) { 
        cpw.disabled = false; 
        cpw.value = '${password}'; 
        cpw.dispatchEvent(new Event('input', { bubbles: true })); 
      }
      
      return 'Form filled via JS';
    })()
  `;

  try {
    await execAsync(`${ocbotCmd} eval "${fillScript.replace(/"/g, '\\"')}"`, { timeout: 15000 });
    console.log('  ✅ 表单已通过 JavaScript 填写');
    console.log(`     First Name: ${firstName}`);
    console.log(`     Last Name: ${lastName}`);
    console.log(`     ZIP: ${zipCode}`);
    console.log(`     Email: ${email}`);
    console.log(`     Password: ${password}`);
    await new Promise(r => setTimeout(r, 1000));
  } catch (error) {
    console.log(`  ❌ JavaScript 填写失败: ${error.message}`);
    console.log('  尝试使用原生 fill 命令...');
    
    // 备用：使用原生 fill
    const fields = [
      { selector: '[name="input-text-First Name"]', value: firstName },
      { selector: '[name="input-text-Last Name"]', value: lastName },
      { selector: '[name="input-text-Zip/Postal Code"]', value: zipCode.toString() },
      { selector: '[name="input-text-Email"]', value: email },
      { selector: '#password', value: password },
      { selector: '#confirmPassword', value: password }
    ];
    
    for (const field of fields) {
      try {
        await execAsync(`${ocbotCmd} fill "${field.selector}" "${field.value}"`, { timeout: 5000 });
        console.log(`    ✅ ${field.selector}`);
      } catch (e) {
        console.log(`    ❌ ${field.selector}: ${e.message}`);
      }
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // 截图保存
  console.log('📸 Step 6: 截图保存...');
  try {
    await execAsync(`${ocbotCmd} screenshot registration-test-filled.png`, { timeout: 10000 });
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
      await execAsync(`${ocbotCmd} click "button[type=submit]"`, { timeout: 10000 });
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
