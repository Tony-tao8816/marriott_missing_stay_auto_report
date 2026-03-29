#!/usr/bin/env node

const fs = require('node:fs/promises');
const path = require('node:path');
const { Command } = require('commander');
const { PDFArray, PDFDict, PDFDocument, PDFName } = require('pdf-lib');
const { decodePDFRawStream } = require('pdf-lib/cjs/core');

const { parseMarriottPDF } = require('./parser');
const { ensureDir } = require('../utils/paths');

const TARGET_FIELD_VALUE = 'HWANG154';
const METADATA_BLOCK_PATTERN = /~+\{\[/;

function parseArgs(argv) {
  const program = new Command();

  program
    .name('process-pdf')
    .description('解析 PDF、备份原件并生成清理后的 folio 副本')
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

function collectPageStreams(page) {
  const contents = page.node.Contents();

  if (!contents) {
    return [];
  }

  if (contents instanceof PDFArray) {
    const streams = [];

    for (let index = 0; index < contents.size(); index += 1) {
      const stream = contents.lookup(index);
      if (stream) {
        streams.push(stream);
      }
    }

    return streams;
  }

  return [contents];
}

function parseToUnicodeReverseMap(toUnicodeStream) {
  const decoded = Buffer.from(decodePDFRawStream(toUnicodeStream).decode()).toString('latin1');
  const reverseMap = new Map();

  for (const match of decoded.matchAll(/<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>/g)) {
    const sourceCode = match[1].toUpperCase();
    const targetHex = match[2];

    try {
      const unicodeChar = String.fromCodePoint(parseInt(targetHex, 16));
      if (!reverseMap.has(unicodeChar)) {
        reverseMap.set(unicodeChar, sourceCode);
      }
    } catch {
      // Ignore malformed mappings and keep processing the remaining cmap entries.
    }
  }

  return reverseMap;
}

function buildTargetReplacementSpecs(page) {
  const resources = page.node.Resources();
  const fonts = resources?.lookupMaybe(PDFName.of('Font'), PDFDict);
  const context = page.node.context;

  if (!fonts) {
    return [];
  }

  const specs = [];

  for (const [, fontRef] of fonts.entries()) {
    const font = context.lookup(fontRef, PDFDict);
    const toUnicodeRef = font.get(PDFName.of('ToUnicode'));

    if (!toUnicodeRef) {
      continue;
    }

    const toUnicodeStream = context.lookup(toUnicodeRef);
    const reverseMap = parseToUnicodeReverseMap(toUnicodeStream);
    const spaceCode = reverseMap.get(' ');

    if (!spaceCode) {
      continue;
    }

    const encodedChars = [];
    let canEncode = true;

    for (const character of TARGET_FIELD_VALUE) {
      const code = reverseMap.get(character);
      if (!code) {
        canEncode = false;
        break;
      }
      encodedChars.push(code);
    }

    if (!canEncode) {
      continue;
    }

    specs.push({
      search: `<${encodedChars.join('')}>`,
      replace: `<${spaceCode.repeat(TARGET_FIELD_VALUE.length)}>`
    });
  }

  return dedupeSpecs(specs);
}

function dedupeSpecs(specs) {
  const seen = new Set();
  return specs.filter((spec) => {
    if (seen.has(spec.search)) {
      return false;
    }
    seen.add(spec.search);
    return true;
  });
}

function stripMetadataBlocks(content) {
  let removedBlocks = 0;

  const cleaned = content.replace(/BT[\s\S]*?ET\r?\n?/g, (block) => {
    if (!METADATA_BLOCK_PATTERN.test(block)) {
      return block;
    }

    removedBlocks += 1;
    return '';
  });

  return { cleaned, removedBlocks };
}

function replaceAllLiteral(source, search, replacement) {
  if (!search || search === replacement) {
    return { cleaned: source, replacements: 0 };
  }

  const parts = source.split(search);
  if (parts.length === 1) {
    return { cleaned: source, replacements: 0 };
  }

  return {
    cleaned: parts.join(replacement),
    replacements: parts.length - 1
  };
}

function sanitizeDecodedStream(decodedContent, replacementSpecs) {
  const metadataResult = stripMetadataBlocks(decodedContent);
  let cleaned = metadataResult.cleaned;
  let removedTargetValues = 0;

  for (const spec of replacementSpecs) {
    const replacementResult = replaceAllLiteral(cleaned, spec.search, spec.replace);
    cleaned = replacementResult.cleaned;
    removedTargetValues += replacementResult.replacements;
  }

  const literalResult = replaceAllLiteral(cleaned, TARGET_FIELD_VALUE, ''.padEnd(TARGET_FIELD_VALUE.length, ' '));
  cleaned = literalResult.cleaned;
  removedTargetValues += literalResult.replacements;

  return {
    cleaned,
    removedMetadataBlocks: metadataResult.removedBlocks,
    removedTargetValues
  };
}

function rewriteStream(stream, content) {
  // 保持原始压缩格式，只更新内容
  const originalFilter = stream.dict.get(PDFName.of('Filter'));
  
  // 如果原来是压缩的，需要重新压缩内容
  if (originalFilter) {
    const filterName = originalFilter.toString();
    if (filterName.includes('FlateDecode')) {
      // 使用 zlib 压缩
      const zlib = require('zlib');
      const compressed = zlib.deflateSync(Buffer.from(content, 'latin1'));
      stream.contents = compressed;
    } else {
      // 其他压缩格式，直接用原始内容
      stream.contents = Buffer.from(content, 'latin1');
    }
  } else {
    // 无压缩，直接写入
    stream.contents = Buffer.from(content, 'latin1');
  }
}

async function createCleanedPdf(inputPath) {
  const sourceBytes = await fs.readFile(inputPath);
  const pdfDoc = await PDFDocument.load(sourceBytes, { updateMetadata: false });
  const summary = {
    pagesProcessed: 0,
    metadataBlocksRemoved: 0,
    targetValuesRemoved: 0
  };

  for (const page of pdfDoc.getPages()) {
    const replacementSpecs = buildTargetReplacementSpecs(page);
    const streams = collectPageStreams(page);

    for (const stream of streams) {
      const decodedContent = Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1');
      const result = sanitizeDecodedStream(decodedContent, replacementSpecs);

      rewriteStream(stream, result.cleaned);
      summary.metadataBlocksRemoved += result.removedMetadataBlocks;
      summary.targetValuesRemoved += result.removedTargetValues;
    }

    summary.pagesProcessed += 1;
  }

  const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
  return { pdfBytes, summary };
}

async function processPdf({ input, output }) {
  const inputPath = path.resolve(input);
  const paths = buildOutputPaths(inputPath, output);

  await ensureDir(paths.outputDir);
  await ensureDir(paths.backupDir);

  const parsedData = await parseMarriottPDF(inputPath);
  const { pdfBytes, summary } = await createCleanedPdf(inputPath);

  await fs.writeFile(
    paths.jsonPath,
    JSON.stringify(
      {
        sourceFile: inputPath,
        processedAt: new Date().toISOString(),
        parsedData,
        cleanup: summary
      },
      null,
      2
    ),
    'utf8'
  );

  await fs.copyFile(inputPath, paths.backupPdfPath);
  await fs.writeFile(paths.folioPdfPath, pdfBytes);

  return {
    ...paths,
    cleanup: summary
  };
}

async function main() {
  try {
    const options = parseArgs(process.argv);
    const result = await processPdf(options);

    console.log(`JSON 已保存: ${result.jsonPath}`);
    console.log(`原 PDF 备份: ${result.backupPdfPath}`);
    console.log(`清理副本: ${result.folioPdfPath}`);
    console.log(`页面数: ${result.cleanup.pagesProcessed}`);
    console.log(`移除元数据块: ${result.cleanup.metadataBlocksRemoved}`);
    console.log(`移除 ${TARGET_FIELD_VALUE} 次数: ${result.cleanup.targetValuesRemoved}`);
  } catch (error) {
    console.error(`处理失败: ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  createCleanedPdf,
  processPdf,
  sanitizeDecodedStream
};
