#!/usr/bin/env node

/**
 * 万豪注册测试脚本 - 使用用户 Chrome (Remote Debugging)
 * 
 * 连接到你的 Chrome 实例，填写表单后暂停供检查
 * 使用方式: npm run test-registration-chrome
 */

const { chromium } = require('playwright');
const { RyyAsiaService } = require('../../email/ryyasia');
const dotenv = require('dotenv');
const readline = require('readline');

dotenv.config();

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
  console.log('🧪 万豪注册测试模式 (使用你的 Chrome)\n');
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

  // 连接到你的 Chrome
  console.log('🌐 Step 1: 连接到你的 Chrome...');
  
  let browser;
  let connected = false;
  
  // 首先获取 WebSocket 地址
  try {
    console.log('   获取 Chrome DevTools WebSocket 地址...');
    const http = require('http');
    
    const wsUrl = await new Promise((resolve, reject) => {
      const req = http.get('http://127.0.0.1:9222/json/version', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json.webSocketDebuggerUrl);
          } catch (e) {
            reject(new Error('无法解析响应'));
          }
        });
      });
      req.on('error', reject);
      req.setTimeout(5000, () => reject(new Error('超时')));
    });
    
    console.log(`   WebSocket URL: ${wsUrl}`);
    
    // 使用 WebSocket URL 连接
    browser = await chromium.connectOverCDP(wsUrl);
    console.log(`✅ 已连接到 Chrome\n`);
    connected = true;
  } catch (error) {
    console.log(`   ❌ 连接失败: ${error.message}`);
    console.log('\n❌ 无法连接到 Chrome:');
    console.log('   请确保 Chrome 已启动 Remote Debugging:');
    console.log('   /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222');
    console.log('\n   或者检查 Chrome 是否在正确的端口运行。\n');
    process.exit(1);
  }

  // 获取现有页面或新建
  const context = browser.contexts()[0] || await browser.newContext();
  let page = context.pages()[0];
  
  if (!page) {
    page = await context.newPage();
  }

  // 导航到注册页
  console.log('📍 Step 2: 导航到万豪注册页面...');
  const regUrl = 'https://www.marriott.com/loyalty/createAccount/createAccountPage1.mi';
  
  try {
    await page.goto(regUrl, { waitUntil: 'networkidle', timeout: 60000 });
    console.log('✅ 页面加载完成\n');
  } catch (error) {
    console.log(`❌ 导航失败: ${error.message}`);
    await browser.close();
    process.exit(1);
  }

  // 等待页面完全加载
  await page.waitForTimeout(3000);

  // 填写表单
  console.log('📝 Step 3: 填写注册表单...\n');

  try {
    // First Name
    await page.fill('[name="input-text-First Name"]', firstName);
    console.log(`  ✅ First Name: ${firstName}`);
    await page.waitForTimeout(500);

    // Last Name
    await page.fill('[name="input-text-Last Name"]', lastName);
    console.log(`  ✅ Last Name: ${lastName}`);
    await page.waitForTimeout(500);

    // ZIP Code
    await page.fill('[name="input-text-Zip/Postal Code"]', zipCode.toString());
    console.log(`  ✅ ZIP Code: ${zipCode}`);
    await page.waitForTimeout(500);

    // Email
    await page.fill('[name="input-text-Email"]', email);
    console.log(`  ✅ Email: ${email}`);
    await page.waitForTimeout(500);

    // Password
    await page.fill('#password', password);
    console.log(`  ✅ Password: ${password}`);
    await page.waitForTimeout(500);

    // Confirm Password - 先点击解除禁用
    await page.click('#confirmPassword');
    await page.waitForTimeout(300);
    await page.fill('#confirmPassword', password);
    console.log(`  ✅ Confirm Password: ${password}`);
    await page.waitForTimeout(500);

  } catch (error) {
    console.log(`  ❌ 填写失败: ${error.message}`);
  }

  // 选择国家（如果未选中 USA）
  console.log('\n🌍 Step 4: 选择国家...');
  try {
    // 检查当前国家
    const countryDropdown = await page.$('[data-testid="USA"]');
    if (!countryDropdown) {
      // 点击下拉框
      await page.click('#countryToCreate, [aria-label*="country" i]');
      await page.waitForTimeout(1000);
      // 选择 USA
      await page.click('text=United States, text=USA');
      console.log('  ✅ Country: United States (US)\n');
    } else {
      console.log('  ✅ Country: United States (US) - 已选择\n');
    }
  } catch (error) {
    console.log(`  ⚠️  国家选择可能失败: ${error.message}\n`);
  }

  // 截图保存
  console.log('📸 Step 5: 截图保存...');
  try {
    await page.screenshot({ path: 'registration-test-filled.png', fullPage: true });
    console.log('  ✅ 截图已保存: registration-test-filled.png\n');
  } catch (error) {
    console.log(`  ⚠️  截图失败: ${error.message}\n`);
  }

  // 暂停等待检查
  console.log('==========================================');
  console.log('🛑 表单已填写完成！');
  console.log('==========================================\n');
  console.log('📋 请检查 Chrome 窗口中的表单填写是否正确:\n');
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
      // 查找提交按钮
      const submitButton = await page.$('button[type="submit"], button:has-text("JOIN"), button:has-text("Create Account")');
      if (submitButton) {
        await submitButton.click();
        console.log('✅ 注册已提交！');
        console.log('\n请检查 Chrome 中的注册结果。');
      } else {
        console.log('❌ 未找到提交按钮');
      }
    } catch (error) {
      console.log(`❌ 提交失败: ${error.message}`);
    }
  } else {
    console.log('\n👋 测试已取消。');
    console.log('Chrome 保持打开状态供您检查。');
  }

  // 不关闭浏览器（保持 Chrome 打开）
  console.log('\n📌 注意: 未关闭 Chrome，请手动关闭。');
  
  process.exit(0);
}

// 运行测试
testRegistration().catch(async error => {
  console.error('\n❌ 测试失败:', error.message);
  process.exit(1);
});
