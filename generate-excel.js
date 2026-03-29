const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { parseMarriottPDF } = require('./src/pdf/parser');

async function generateExcel(pdfPath, outputDir) {
  console.log(`📄 解析 PDF: ${pdfPath}`);
  
  const parsedData = await parseMarriottPDF(pdfPath);
  const info = parsedData.extractedInfo;
  
  // 创建工作簿
  const wb = XLSX.utils.book_new();
  
  // 1. 基础信息 Sheet
  const basicInfoData = [
    ['字段', '值'],
    ['模板名称', info.templateName || ''],
    ['酒店名称', info.hotelName || ''],
    ['酒店地址', info.hotelAddress || ''],
    ['酒店电话', info.hotelPhone || ''],
    ['酒店网站', info.hotelWebsite || ''],
    ['客人姓名', info.guestName || ''],
    ['客人姓名(英文)', info.guestNameEn || ''],
    ['客人姓名(中文)', info.guestNameCn || ''],
    ['房号', info.roomNumber || ''],
    ['公司', info.company || ''],
    ['会员号码', info.loyaltyNumber || ''],
    ['AR号', info.arNumber || ''],
    ['确认号', info.confirmationNumber || ''],
    ['账单号', info.folioNumber || ''],
    ['收银员', info.cashier || ''],
    ['客人电话', info.guestPhone || ''],
    ['客人邮箱', info.guestEmail || ''],
    ['入住日期', info.arrivalDate || ''],
    ['离店日期', info.departureDate || ''],
    ['账单打印日期', info.printedAt || ''],
    ['消费合计', info.totalCharges || ''],
    ['付款合计', info.totalCredits || ''],
    ['余额', info.balance || ''],
    ['货币', info.currency || ''],
    ['页数', parsedData.metadata.pageCount],
    ['文件名', parsedData.metadata.fileName],
    ['解析时间', parsedData.metadata.parsedAt]
  ];
  const wsBasic = XLSX.utils.aoa_to_sheet(basicInfoData);
  XLSX.utils.book_append_sheet(wb, wsBasic, '基础信息');
  
  // 2. 消费明细 Sheet
  if (info.charges && info.charges.length > 0) {
    const chargesData = [['日期', '描述', '金额']];
    info.charges.forEach(charge => {
      chargesData.push([charge.date || '', charge.description || '', charge.amount || '']);
    });
    const wsCharges = XLSX.utils.aoa_to_sheet(chargesData);
    XLSX.utils.book_append_sheet(wb, wsCharges, '消费明细');
  }
  
  // 3. 付款明细 Sheet
  if (info.payments && info.payments.length > 0) {
    const paymentsData = [['日期', '类型', '金额']];
    info.payments.forEach(payment => {
      paymentsData.push([payment.date || '', payment.type || '', payment.amount || '']);
    });
    const wsPayments = XLSX.utils.aoa_to_sheet(paymentsData);
    XLSX.utils.book_append_sheet(wb, wsPayments, '付款明细');
  }
  
  // 4. 行项目明细 Sheet (LineItems)
  if (info.lineItems && info.lineItems.length > 0) {
    const lineItemsData = [['序号', '日期', '描述', '消费金额', '付款金额', '页码']];
    info.lineItems.forEach(item => {
      lineItemsData.push([
        item.sortOrder,
        item.serviceDate || '',
        item.description || '',
        item.chargeAmount || '',
        item.creditAmount || '',
        item.pageNumber
      ]);
    });
    const wsLineItems = XLSX.utils.aoa_to_sheet(lineItemsData);
    XLSX.utils.book_append_sheet(wb, wsLineItems, '行项目明细');
  }
  
  // 5. 元数据块 Sheet
  if (info.metadataBlock && Object.keys(info.metadataBlock).length > 0) {
    const metadataData = [['键', '值']];
    Object.entries(info.metadataBlock).forEach(([key, value]) => {
      metadataData.push([key, value]);
    });
    const wsMetadata = XLSX.utils.aoa_to_sheet(metadataData);
    XLSX.utils.book_append_sheet(wb, wsMetadata, '元数据块');
  }
  
  // 6. 原始文本 Sheet
  const rawTextLines = parsedData.rawText.split('\n').map((line, index) => [index + 1, line]);
  rawTextLines.unshift(['行号', '内容']);
  const wsRawText = XLSX.utils.aoa_to_sheet(rawTextLines);
  XLSX.utils.book_append_sheet(wb, wsRawText, '原始文本');
  
  // 7. 补登申请 Sheet
  const stayReportData = [
    ['字段', '值'],
    ['酒店名称', info.hotelName || ''],
    ['酒店地址', info.hotelAddress || ''],
    ['入住日期', info.arrivalDate || ''],
    ['离店日期', info.departureDate || ''],
    ['确认号', info.confirmationNumber || ''],
    ['房号', info.roomNumber || ''],
    ['客人姓名', info.guestName || ''],
    ['会员号码', info.loyaltyNumber || ''],
    ['消费合计', info.totalCharges || ''],
    ['货币', info.currency || '']
  ];
  const wsStayReport = XLSX.utils.aoa_to_sheet(stayReportData);
  XLSX.utils.book_append_sheet(wb, wsStayReport, '补登申请');
  
  // 保存文件
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(outputDir, `folio_parse_${timestamp}.xlsx`);
  XLSX.writeFile(wb, outputPath);
  
  console.log(`\n✅ Excel 文件已生成: ${outputPath}`);
  console.log(`\n📊 数据摘要:`);
  console.log(`  - 基础信息: ${basicInfoData.length - 1} 条`);
  console.log(`  - 消费明细: ${info.charges?.length || 0} 条`);
  console.log(`  - 付款明细: ${info.payments?.length || 0} 条`);
  console.log(`  - 行项目明细: ${info.lineItems?.length || 0} 条`);
  console.log(`  - 元数据块: ${Object.keys(info.metadataBlock || {}).length} 条`);
  console.log(`  - 原始文本: ${rawTextLines.length - 1} 行`);
  
  return outputPath;
}

// 主函数
async function main() {
  const pdfPath = process.argv[2] || '/Users/taoxingliang/.openclaw/media/inbound/312_315---70e69522-2a8a-429e-bdb9-9965999eeed1.pdf';
  const outputDir = process.argv[3] || './output/excel';
  
  try {
    const excelPath = await generateExcel(pdfPath, outputDir);
    console.log(`\n🎉 完成! 文件位置: ${excelPath}`);
  } catch (error) {
    console.error(`❌ 错误: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { generateExcel };
