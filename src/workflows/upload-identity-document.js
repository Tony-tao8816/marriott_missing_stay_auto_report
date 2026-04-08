const fs = require('node:fs');
const path = require('node:path');
const { openWorkspace } = require('../storage/workspace');

async function uploadIdentityDocumentWorkflow({ workspacePath, sourceFilePath }) {
  if (!workspacePath) {
    throw new Error('Missing required option: workspacePath');
  }

  if (!sourceFilePath) {
    throw new Error('Missing required option: sourceFilePath');
  }

  const absoluteWorkspacePath = path.resolve(workspacePath);
  const absoluteSourceFilePath = path.resolve(sourceFilePath);

  if (!fs.existsSync(absoluteSourceFilePath)) {
    throw new Error(`Identity document not found: ${absoluteSourceFilePath}`);
  }

  const workspace = await openWorkspace(absoluteWorkspacePath);
  const destinationPath = path.join(workspace.idDirectory, path.basename(absoluteSourceFilePath));

  await fs.promises.copyFile(absoluteSourceFilePath, destinationPath);

  return {
    status: 'ok',
    workspaceDirectory: absoluteWorkspacePath,
    sourceFilePath: absoluteSourceFilePath,
    destinationPath,
    idDirectory: workspace.idDirectory
  };
}

module.exports = {
  uploadIdentityDocumentWorkflow
};
