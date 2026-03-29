#!/usr/bin/env node

const fs = require('node:fs/promises');
const path = require('node:path');
const zlib = require('zlib');
const { PDFDocument, PDFName } = require('pdf-lib');
const { decodePDFRawStream } = require('pdf-lib/cjs/core');

const TARGET_VALUE = 'HWANG154';

async function processPdf(inputPath, outputDir) {
  const fileName = path.basename(inputPath);
  const baseName = path.basename(inputPath, path.extname(inputPath));
  
  const paths = {
    backupDir: path.join(outputDir, 'backup'),
    jsonPath: path.join(outputDir, `${baseName}.json`),
    backupPdfPath: path.join(outputDir, 'backup', fileName),
    folioPdfPath: path.join(outputDir, `${baseName}_folio.pdf`)
  };

  await fs.mkdir(paths.backupDir, { recursive: true });

  // 1. 备份原文件
  await fs.copyFile(inputPath, paths.backupPdfPath);

  // 2. 使用 pdf-lib 加载并处理
  const sourceBytes = await fs.readFile(inputPath);
  const pdfDoc = await PDFDocument.load(sourceBytes, { 
    updateMetadata: false,
    ignoreEncryption: true 
  });

  let changes = {
    hwangRemoved: 0,
    metadataBlocksRemoved: 0
  };

  // 3. 处理每一页的内容流
  for (const page of pdfDoc.getPages()) {
    const contents = page.node.Contents();
    if (!contents) continue;

    // 获取所有内容流
    const streams = [];
    if (contents.constructor.name === 'PDFArray') {
      for (let i = 0; i < contents.size(); i++) {
        const stream = pdfDoc.context.lookup(contents.get(i));
        if (stream) streams.push(stream);
      }
    } else {
      const stream = pdfDoc.context.lookup(contents);
      if (stream) streams.push(stream);
    }

    for (const stream of streams) {
      try {
        // 解码内容流
        const decoded = Buffer.from(decodePDFRawStream(stream).decode());
        let content = decoded.toString('latin1');

        // 移除元数据块 ~{[...]} 和 ~~{[...]}
        const metadataPattern = /~{1,2}\{[\s\S]*?\}\}/g;
        const metadataMatches = content.match(metadataPattern);
        if (metadataMatches) {
          changes.metadataBlocksRemoved += metadataMatches.length;
          content = content.replace(metadataPattern, '');
        }

        // 移除 HWANG154 明文（包括括号形式和纯文本）
        const hwangPatterns = [
          new RegExp(`\\(${TARGET_VALUE}\\)`, 'g'),  // (HWANG154)
          new RegExp(TARGET_VALUE, 'g')               // HWANG154
        ];
        for (const pattern of hwangPatterns) {
          const hwangMatches = content.match(pattern);
          if (hwangMatches) {
            changes.hwangRemoved += hwangMatches.length;
            content = content.replace(pattern, match => ' '.repeat(match.length));
          }
        }

        // 检查内容是否被修改
        if (content !== decoded.toString('latin1')) {
          // 重新压缩内容
          const compressed = zlib.deflateSync(Buffer.from(content, 'latin1'));
          
          // 更新流内容
          stream.contents = compressed;
          
          // 确保流标记为有压缩
          if (!stream.dict.has(PDFName.of('Filter'))) {
            stream.dict.set(PDFName.of('Filter'), PDFName.of('FlateDecode'));
          }
        }
      } catch (err) {
        console.log(`警告: 处理流时出错: ${err.message}`);
      }
    }
  }

  // 4. 保存清理后的 PDF
  const pdfBytes = await pdfDoc.save({ 
    useObjectStreams: false,
    addDefaultPage: false 
  });
  await fs.writeFile(paths.folioPdfPath, pdfBytes);

  // 5. 保存报告
  const report = {
    sourceFile: inputPath,
    processedAt: new Date().toISOString(),
    changes,
    outputFiles: paths
  };
  await fs.writeFile(paths.jsonPath, JSON.stringify(report, null, 2), 'utf8');

  return { paths, changes };
}

async function main() {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf('--input') !== -1 ? args.indexOf('--input') : args.indexOf('-i');
  const outputIndex = args.indexOf('--output') !== -1 ? args.indexOf('--output') : args.indexOf('-o');
  
  if (inputIndex === -1 || outputIndex === -1) {
    console.error('用法: node pdf-cleaner.js --input <pdf路径> --output <输出目录>');
    process.exit(1);
  }

  const inputPath = args[inputIndex + 1];
  const outputDir = args[outputIndex + 1];

  try {
    const result = await processPdf(inputPath, outputDir);
    console.log('✅ 处理完成:');
    console.log(`  JSON 报告: ${result.paths.jsonPath}`);
    console.log(`  原 PDF 备份: ${result.paths.backupPdfPath}`);
    console.log(`  清理副本: ${result.paths.folioPdfPath}`);
    console.log(`  移除 HWANG154: ${result.changes.hwangRemoved} 次`);
    console.log(`  移除元数据块: ${result.changes.metadataBlocksRemoved} 个`);
  } catch (error) {
    console.error(`❌ 处理失败: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { processPdf };
