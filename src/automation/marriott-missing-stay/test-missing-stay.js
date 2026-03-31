#!/usr/bin/env node

/**
 * 万豪补登测试脚本
 * 
 * 使用 PDF 账单数据测试补登流程
 */

const { MarriottMissingStay } = require('./marriott-missing-stay');

async function testMissingStay() {
  console.log('🧪 万豪补登测试\n');
  console.log('==========================================\n');

  // PDF 账单信息
  const pdfData = {
    hotel: 'Rissai Valley, a Ritz-Carlton Reserve',
    guestName: 'Xie, Min',
    confirmationNumber: '88008405',
    arrivalDate: '2026-02-28',
    departureDate: '2026-03-03',
    roomNumber: '315'
  };

  console.log('📄 PDF 账单信息:');
  console.log(`  酒店: ${pdfData.hotel}`);
  console.log(`  客人: ${pdfData.guestName}`);
  console.log(`  确认号: ${pdfData.confirmationNumber}`);
  console.log(`  入住: ${pdfData.arrivalDate}`);
  console.log(`  离店: ${pdfData.departureDate}`);
  console.log(`  房号: ${pdfData.roomNumber}\n`);

  // 生成账户信息（使用注册时的数据）
  const [lastName, firstName] = pdfData.guestName.split(', ');
  const email = `${firstName.toLowerCase()}_${lastName.toLowerCase()}@ryy.asia`;
  const password = `${lastName.charAt(0).toUpperCase()}${firstName.charAt(0).toLowerCase()}@marriott`;

  console.log('🔧 账户信息:');
  console.log(`  邮箱: ${email}`);
  console.log(`  密码: ${password}\n`);

  console.log('==========================================\n');

  // 创建补登实例
  const stay = new MarriottMissingStay({
    email: email,
    password: password
  });

  try {
    // 执行补登流程
    const result = await stay.submit({
      hotelName: pdfData.hotel,
      checkInDate: pdfData.arrivalDate,
      checkOutDate: pdfData.departureDate,
      confirmationNumber: pdfData.confirmationNumber,
      roomNumber: pdfData.roomNumber,
      // folioPdfPath: './output/processed/312_315_folio.pdf' // 如果需要上传账单
    });

    console.log('\n==========================================');
    console.log('📊 执行结果');
    console.log('==========================================\n');
    
    result.steps.forEach((step, i) => {
      console.log(`  ${i + 1}. ${step.step}: ${step.status}`);
    });

    if (result.success) {
      console.log('\n✅ 补登表单已准备好！');
      console.log('请在浏览器中检查并手动提交。\n');
    }

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    process.exit(1);
  }
}

// 运行测试
testMissingStay();
