const fs = require('node:fs');
const path = require('node:path');
const { extractPdfData } = require('../pdf/extract-pdf-data');
const { sanitizePdf } = require('../pdf/sanitize-pdf');
const {
  createWorkspace,
  writeArtifacts
} = require('../storage/workspace');

async function processPdfWorkflow({ pdfPath, outputRoot }) {
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF not found: ${pdfPath}`);
  }

  const originalExtraction = extractPdfData(pdfPath);
  const workspace = await createWorkspace({
    extraction: originalExtraction,
    sourcePdfPath: pdfPath,
    outputRoot
  });

  const sanitizedPdfPath = path.join(
    workspace.modifyDirectory,
    `${path.parse(pdfPath).name}_folio.pdf`
  );

  sanitizePdf({
    sourcePdfPath: pdfPath,
    destinationPdfPath: sanitizedPdfPath,
    extraction: originalExtraction
  });

  const modifiedExtraction = extractPdfData(sanitizedPdfPath);

  const artifactPaths = await writeArtifacts({
    workspace,
    originalExtraction,
    modifiedExtraction,
    sourcePdfPath: pdfPath,
    sanitizedPdfPath
  });

  return {
    status: 'ok',
    sourcePdfPath: pdfPath,
    workspaceDirectory: workspace.directory,
    guest: originalExtraction.summary.guest,
    generatedFiles: artifactPaths
  };
}

module.exports = {
  processPdfWorkflow
};
