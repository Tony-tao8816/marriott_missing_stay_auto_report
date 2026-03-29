#!/usr/bin/env node

const fs = require('node:fs/promises');
const path = require('node:path');
const { Command } = require('commander');

const TARGET_VALUE = 'HWANG154';

function parseArgs(argv) {
  const program = new Command();

  program
    .name('simple-pdf-cleaner')
    .description('简单 PDF 清理：仅移除 HWANG154 和元数据块')
    .requiredOption('-i, --input <path>', 'PDF 文件路径')
    .requiredOption('-o, --output <dir>', '输出目录');

  program.parse(argv);
  return program.opts();
}

function buildOutputPaths(inputPath, outputDir) {
  const fileName = path.basename(inputPath);
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const resolvedOutputDir = path.resolve(outputDir);

  return {
    outputDir: resolvedOutputDir,
    backupDir: path.join(resolvedOutputDir, 'backup'),
    jsonPath: path.join(resolvedOutputDir, `${baseName}.json`),
    backupPdfPath: path.join(resolvedOutputDir, 'backup', fileName),
    folioPdfPath: path.join(resolvedOutputDir, `${baseName}_folio.pdf`)
  };
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
  return dirPath;
}

function cleanPdfBuffer(buffer) {
  let content = buffer.toString('latin1');
  let changes = {
    hwangRemoved: 0,
    metadataBlocksRemoved: 0
  };

  // 1. 移除所有 ~{[...]} 元数据块（包括 ~~{[...]）
  // 匹配模式：~{[ 开始到 ]} 结束，中间可能包含嵌套或换行
  const metadataPattern = /~{1,2}\{[\s\S]*?\}\}/g;
  const metadataMatches = content.match(metadataPattern);
  if (metadataMatches) {
    changes.metadataBlocksRemoved = metadataMatches.length;
    content = content.replace(metadataPattern, '');
  }

  // 2. 移除 HWANG154 明文（保留空白以保持长度）
  const hwangPattern = new RegExp(TARGET_VALUE, 'g');
  const hwangMatches = content.match(hwangPattern);
  if (hwangMatches) {
    changes.hwangRemoved = hwangMatches.length;
    // 替换为相同长度的空格，避免破坏布局
    content = content.replace(hwangPattern, ' '.repeat(TARGET_VALUE.length));
  }

  // 3. 清理可能留下的空行（保留结构）
  // 不移除其他内容，保持 PDF 结构完整

  return { content, changes };
}

async function simpleProcessPdf({ input, output }) {
  const inputPath = path.resolve(input);
  const paths = buildOutputPaths(inputPath, output);

  // 确保输出目录存在
  await ensureDir(paths.outputDir);
  await ensureDir(paths.backupDir);

  // 读取原始 PDF
  const originalBuffer = await fs.readFile(inputPath);

  // 清理 PDF
  const { content: cleanedContent, changes } = cleanPdfBuffer(originalBuffer);
  const cleanedBuffer = Buffer.from(cleanedContent, 'latin1');

  // 备份原文件
  await fs.copyFile(inputPath, paths.backupPdfPath);

  // 写入清理后的文件
  await fs.writeFile(paths.folioPdfPath, cleanedBuffer);

  // 写入简单的处理报告
  const report = {
    sourceFile: inputPath,
    processedAt: new Date().toISOString(),
    changes,
    outputFiles: {
      backup: paths.backupPdfPath,
      folio: paths.folioPdfPath
    }
  };
  await fs.writeFile(paths.jsonPath, JSON.stringify(report, null, 2), 'utf8');

  return {
    ...paths,
    changes
  };
}

async function main() {
  try {
    const options = parseArgs(process.argv);
    const result = await simpleProcessPdf(options);

    console.log(`✅ 处理完成:`);
    console.log(`  JSON 报告: ${result.jsonPath}`);
    console.log(`  原 PDF 备份: ${result.backupPdfPath}`);
    console.log(`  清理副本: ${result.folioPdfPath}`);
    console.log(`  移除 HWANG154: ${result.changes.hwangRemoved} 次`);
    console.log(`  移除元数据块: ${result.changes.metadataBlocksRemoved} 个`);
  } catch (error) {
    console.error(`❌ 处理失败: ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = { simpleProcessPdf, cleanPdfBuffer };
