const fs = require('fs');
const path = require('path');
const { stringify } = require('csv-stringify/sync');

/**
 * 将解析的账单信息转换为 CSV 格式
 * @param {Object} parsedData - parseMarriottPDF 返回的数据
 * @returns {Object} 包含多个 CSV 字符串的对象
 */
function convertToCSV(parsedData) {
  const { extractedInfo, metadata } = parsedData;
  
  // 1. 基础信息 CSV
  const basicInfoRecords = [
    { category: '酒店名称', value: extractedInfo.hotelName || '' },
    { category: '酒店地址', value: extractedInfo.hotelAddress || '' },
    { category: '酒店电话', value: extractedInfo.hotelPhone || '' },
    { category: '酒店网站', value: extractedInfo.hotelWebsite || '' },
    { category: '确认号', value: extractedInfo.confirmationNumber || '' },
    { category: '账单号', value: extractedInfo.folioNumber || '' },
    { category: '房号', value: extractedInfo.roomNumber || '' },
    { category: '入住日期', value: extractedInfo.arrivalDate || '' },
    { category: '离店日期', value: extractedInfo.departureDate || '' },
    { category: '账单打印日期', value: extractedInfo.invoicePrintedDate || '' },
    { category: '客人姓名', value: extractedInfo.guestName || '' },
    { category: '会员号码', value: extractedInfo.loyaltyNumber || '' },
    { category: '公司名称', value: extractedInfo.company || '' },
    { category: '消费合计', value: extractedInfo.totalCharges || '' },
    { category: '付款合计', value: extractedInfo.totalCredits || '' },
    { category: '余额', value: extractedInfo.balance || '' },
    { category: '货币', value: extractedInfo.currency || 'CNY' }
  ];
  
  const basicInfoCSV = stringify(basicInfoRecords, {
    header: true,
    columns: ['category', 'value']
  });
  
  // 2. 消费明细 CSV
  let chargesCSV = '';
  if (extractedInfo.charges && extractedInfo.charges.length > 0) {
    chargesCSV = stringify(extractedInfo.charges, {
      header: true,
      columns: ['date', 'description', 'amount']
    });
  } else {
    chargesCSV = 'date,description,amount\n暂无消费明细';
  }
  
  // 3. 付款明细 CSV
  let paymentsCSV = '';
  if (extractedInfo.payments && extractedInfo.payments.length > 0) {
    paymentsCSV = stringify(extractedInfo.payments, {
      header: true,
      columns: ['date', 'type', 'amount']
    });
  } else {
    paymentsCSV = 'date,type,amount\n暂无付款明细';
  }
  
  // 4. 完整原始文本 CSV（用于查看所有内容）
  const rawTextLines = parsedData.rawText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  const rawTextRecords = rawTextLines.map((line, index) => ({
    lineNumber: index + 1,
    content: line
  }));
  
  const rawTextCSV = stringify(rawTextRecords, {
    header: true,
    columns: ['lineNumber', 'content']
  });
  
  return {
    basicInfo: basicInfoCSV,
    charges: chargesCSV,
    payments: paymentsCSV,
    rawText: rawTextCSV,
    metadata: {
      fileName: metadata.fileName,
      pageCount: metadata.pageCount,
      parsedAt: metadata.parsedAt
    }
  };
}

/**
 * 保存 CSV 文件
 * @param {Object} csvData - convertToCSV 返回的数据
 * @param {string} outputDir - 输出目录
 */
function saveCSVFiles(csvData, outputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseName = `pdf_parse_${timestamp}`;
  
  const files = {
    basicInfo: path.join(outputDir, `${baseName}_basic_info.csv`),
    charges: path.join(outputDir, `${baseName}_charges.csv`),
    payments: path.join(outputDir, `${baseName}_payments.csv`),
    rawText: path.join(outputDir, `${baseName}_raw_text.csv`)
  };
  
  fs.writeFileSync(files.basicInfo, csvData.basicInfo, 'utf8');
  fs.writeFileSync(files.charges, csvData.charges, 'utf8');
  fs.writeFileSync(files.payments, csvData.payments, 'utf8');
  fs.writeFileSync(files.rawText, csvData.rawText, 'utf8');
  
  return {
    ...files,
    metadata: csvData.metadata
  };
}

/**
 * 生成补登申请用的 CSV（精简版）
 * @param {Object} extractedInfo - 提取的信息
 * @returns {string} CSV 字符串
 */
function generateStayReportCSV(extractedInfo) {
  const records = [{
    hotelName: extractedInfo.hotelName || '',
    hotelAddress: extractedInfo.hotelAddress || '',
    checkInDate: formatDate(extractedInfo.arrivalDate),
    checkOutDate: formatDate(extractedInfo.departureDate),
    confirmationNumber: extractedInfo.confirmationNumber || '',
    roomNumber: extractedInfo.roomNumber || '',
    guestName: extractedInfo.guestName || '',
    loyaltyNumber: extractedInfo.loyaltyNumber || '',
    totalAmount: extractedInfo.totalCharges || '',
    currency: extractedInfo.currency || 'CNY'
  }];
  
  return stringify(records, {
    header: true,
    columns: [
      'hotelName',
      'hotelAddress', 
      'checkInDate',
      'checkOutDate',
      'confirmationNumber',
      'roomNumber',
      'guestName',
      'loyaltyNumber',
      'totalAmount',
      'currency'
    ]
  });
}

/**
 * 格式化日期 (DD/MM/YY -> YYYY-MM-DD)
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{2})/);
  if (match) {
    const year = parseInt(match[3]) < 50 ? `20${match[3]}` : `19${match[3]}`;
    return `${year}-${match[2]}-${match[1]}`;
  }
  return dateStr;
}

module.exports = {
  convertToCSV,
  saveCSVFiles,
  generateStayReportCSV
};
