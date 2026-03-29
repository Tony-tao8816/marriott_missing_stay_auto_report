#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const fs = require('fs');
const { parseMarriottPDF } = require('./pdf/parser');
const { convertToCSV, saveCSVFiles, generateStayReportCSV } = require('./pdf/csv-exporter');

const program = new Command();

program
  .name('marriott-pdf-parser')
  .description('解析万豪酒店 PDF 账单并导出 CSV');

program
  .command('parse')
  .description('解析 PDF 账单文件')
  .requiredOption('-i, --input <path>', 'PDF 文件路径')
  .option('-o, --output <dir>', 'CSV 输出目录', './output/pdf_parse')
  .option('--stay-report', '同时生成补登申请用的精简 CSV', false)
  .action(async (options) => {
    try {
      console.log(`📄 正在解析 PDF: ${options.input}`);
      
      // 解析 PDF
      const parsedData = await parseMarriottPDF(options.input);
      
      console.log('\n📊 提取到的信息摘要:');
      console.log('-------------------');
      const info = parsedData.extractedInfo;
      console.log(`酒店: ${info.hotelName || '未识别'}`);
      console.log(`确认号: ${info.confirmationNumber || '未识别'}`);
      console.log(`入住: ${info.arrivalDate || '未识别'}`);
      console.log(`离店: ${info.departureDate || '未识别'}`);
      console.log(`客人: ${info.guestName || '未识别'}`);
      console.log(`消费合计: ${info.totalCharges || '未识别'} ${info.currency || ''}`);
      console.log(`消费明细数: ${info.charges?.length || 0} 条`);
      console.log(`付款明细数: ${info.payments?.length || 0} 条`);
      console.log('-------------------\n');
      
      // 转换为 CSV
      const csvData = convertToCSV(parsedData);
      
      // 保存 CSV 文件
      const savedFiles = saveCSVFiles(csvData, options.output);
      
      console.log('✅ CSV 文件已保存:');
      console.log(`  📋 基础信息: ${savedFiles.basicInfo}`);
      console.log(`  💰 消费明细: ${savedFiles.charges}`);
      console.log(`  💳 付款明细: ${savedFiles.payments}`);
      console.log(`  📄 原始文本: ${savedFiles.rawText}`);
      
      // 生成补登申请 CSV
      if (options.stayReport) {
        const stayReportCSV = generateStayReportCSV(info);
        const stayReportPath = path.join(options.output, `stay_report_${Date.now()}.csv`);
        fs.writeFileSync(stayReportPath, stayReportCSV, 'utf8');
        console.log(`  📝 补登申请: ${stayReportPath}`);
      }
      
      console.log('\n📁 文件信息:');
      console.log(`  文件名: ${savedFiles.metadata.fileName}`);
      console.log(`  页数: ${savedFiles.metadata.pageCount}`);
      console.log(`  解析时间: ${savedFiles.metadata.parsedAt}`);
      
    } catch (error) {
      console.error(`❌ 解析失败: ${error.message}`);
      process.exitCode = 1;
    }
  });

program
  .command('raw')
  .description('输出 PDF 的原始文本内容（用于调试）')
  .requiredOption('-i, --input <path>', 'PDF 文件路径')
  .option('-o, --output <path>', '输出文件路径（可选，默认输出到控制台）')
  .action(async (options) => {
    try {
      const parsedData = await parseMarriottPDF(options.input);
      
      if (options.output) {
        fs.writeFileSync(options.output, parsedData.rawText, 'utf8');
        console.log(`✅ 原始文本已保存到: ${options.output}`);
      } else {
        console.log('\n========== PDF 原始文本内容 ==========\n');
        console.log(parsedData.rawText);
        console.log('\n=====================================\n');
      }
    } catch (error) {
      console.error(`❌ 解析失败: ${error.message}`);
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv);
