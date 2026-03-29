#!/usr/bin/env node

const fs = require('node:fs/promises');
const path = require('node:path');
const zlib = require('zlib');
const { PDFDocument, PDFName, PDFDict } = require('pdf-lib');
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
  await fs.copyFile(inputPath, paths.backupPdfPath);

  const sourceBytes = await fs.readFile(inputPath);
  const pdfDoc = await PDFDocument.load(sourceBytes, { updateMetadata: false });

  let changes = { hwangRemoved: 0, metadataBlocksRemoved: 0 };

  // 处理所有间接对象中的流
  for (const [ref, object] of pdfDoc.context.enumerateIndirectObjects()) {
    if (object.constructor.name !== 'PDFRawStream') continue;

    try {
      const decoded = Buffer.from(decodePDFRawStream(object).decode()).toString('latin1');
      let modified = decoded;

      // 1. 移除包含 ~{[ 或 ~~{[ 的文本操作
      // 匹配 ( ... ) Tj 或 < ... > Tj 操作
      const textOpPattern = /\([^)]*\)\s*Tj|<[^>]*>\s*Tj/g;
      modified = modified.replace(textOpPattern, (match) => {
        if (match.includes('~{[') || match.includes('~~{[')) {
          changes.metadataBlocksRemoved++;
          return ''; // 删除整个文本操作
        }
        return match;
      });

      // 2. 处理字体编码的 HWANG154
      let charToGlyph = new Map();
      
      for (const page of pdfDoc.getPages()) {
        const resources = page.node.Resources();
        const fonts = resources?.lookupMaybe(PDFName.of('Font'), PDFDict);
        if (!fonts) continue;
        
        for (const [, fontRef] of fonts.entries()) {
          const font = pdfDoc.context.lookup(fontRef, PDFDict);
          const toUnicodeRef = font.get(PDFName.of('ToUnicode'));
          if (!toUnicodeRef) continue;
          
          const toUnicodeStream = pdfDoc.context.lookup(toUnicodeRef);
          const toUnicodeDecoded = Buffer.from(decodePDFRawStream(toUnicodeStream).decode()).toString('latin1');
          
          for (const match of toUnicodeDecoded.matchAll(/<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>/g)) {
            const glyphId = match[1].toUpperCase();
            const unicodeHex = match[2];
            try {
              const char = String.fromCodePoint(parseInt(unicodeHex, 16));
              if (!charToGlyph.has(char)) charToGlyph.set(char, glyphId);
            } catch {}
          }
        }
      }

      // 替换 HWANG154 字形
      const hwangGlyphs = [];
      for (const char of TARGET_VALUE) {
        const glyph = charToGlyph.get(char);
        if (glyph) hwangGlyphs.push(glyph);
      }
      
      if (hwangGlyphs.length === TARGET_VALUE.length) {
        const hwangPattern = '<' + hwangGlyphs.join('') + '>';
        const spaceGlyph = charToGlyph.get(' ') || '0020';
        const replacePattern = '<' + spaceGlyph.repeat(TARGET_VALUE.length) + '>';
        
        const hwangMatches = modified.match(new RegExp(hwangPattern, 'g'));
        if (hwangMatches) {
          changes.hwangRemoved += hwangMatches.length;
          modified = modified.replace(new RegExp(hwangPattern, 'g'), replacePattern);
        }
      }

      // 3. 也处理明文形式的 HWANG154 (括号形式)
      const plainHwangPattern = /\(HWANG154\)/g;
      const plainMatches = modified.match(plainHwangPattern);
      if (plainMatches) {
        changes.hwangRemoved += plainMatches.length;
        modified = modified.replace(plainHwangPattern, '(        )');
      }

      // 保存修改
      if (modified !== decoded) {
        if (object.dict.has(PDFName.of('Filter'))) {
          const compressed = zlib.deflateSync(Buffer.from(modified, 'latin1'));
          object.contents = compressed;
        } else {
          object.contents = Buffer.from(modified, 'latin1');
        }
      }
    } catch (e) {
      // 忽略解码失败的流
    }
  }

  const outputBytes = await pdfDoc.save({ useObjectStreams: false });
  await fs.writeFile(paths.folioPdfPath, outputBytes);

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
  const inputIdx = args.findIndex(a => a === '--input' || a === '-i');
  const outputIdx = args.findIndex(a => a === '--output' || a === '-o');
  
  if (inputIdx === -1 || outputIdx === -1 || !args[inputIdx + 1] || !args[outputIdx + 1]) {
    console.error('用法: node pdf-cleaner-v3.js --input <pdf路径> --output <输出目录>');
    process.exit(1);
  }

  const result = await processPdf(args[inputIdx + 1], args[outputIdx + 1]);
  console.log('✅ 处理完成:');
  console.log(`  JSON 报告: ${result.paths.jsonPath}`);
  console.log(`  原 PDF 备份: ${result.paths.backupPdfPath}`);
  console.log(`  清理副本: ${result.paths.folioPdfPath}`);
  console.log(`  移除 HWANG154: ${result.changes.hwangRemoved} 次`);
  console.log(`  移除元数据块: ${result.changes.metadataBlocksRemoved} 个`);
}

if (require.main === module) {
  main().catch(e => {
    console.error('❌ 错误:', e.message);
    process.exit(1);
  });
}

module.exports = { processPdf };
