const path = require('node:path');
const fs = require('node:fs');
const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const { processPdfWorkflow } = require('../src/workflows/process-pdf');
const { registerEmailWorkflow } = require('../src/workflows/register-email');

function createWindow() {
  const window = new BrowserWindow({
    width: 1180,
    height: 860,
    minWidth: 960,
    minHeight: 720,
    backgroundColor: '#f3efe7',
    title: 'Marriott Folio Workflow',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  registerHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function registerHandlers() {
  ipcMain.handle('dialog:pickPdf', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Marriott PDF',
      properties: ['openFile'],
      filters: [
        { name: 'PDF Files', extensions: ['pdf'] }
      ]
    });

    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('dialog:pickWorkspace', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Existing Workspace Folder',
      properties: ['openDirectory']
    });

    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('dialog:pickOutputRoot', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Output Root',
      properties: ['openDirectory', 'createDirectory']
    });

    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('workflow:processPdf', async (_event, payload) => {
    try {
      return await processPdfWorkflow({
        pdfPath: payload.pdfPath,
        outputRoot: payload.outputRoot || undefined
      });
    } catch (error) {
      throw serializeError(error);
    }
  });

  ipcMain.handle('workflow:registerEmail', async (_event, payload) => {
    try {
      return await registerEmailWorkflow({
        pdfPath: payload.pdfPath || undefined,
        workspacePath: payload.workspacePath || undefined,
        outputRoot: payload.outputRoot || undefined,
        mailApiBaseUrl: payload.mailApiBaseUrl,
        mailAdminEmail: payload.mailAdminEmail,
        mailAdminPassword: payload.mailAdminPassword,
        mailDomain: payload.mailDomain,
        notifyRecipient: payload.notifyRecipient
      });
    } catch (error) {
      throw serializeError(error);
    }
  });

  ipcMain.handle('shell:openPath', async (_event, targetPath) => {
    if (!targetPath) {
      return '';
    }

    return shell.openPath(targetPath);
  });

  ipcMain.handle('workspace:readExtraction', async (_event, workspacePath) => {
    try {
      const extractionPath = path.join(workspacePath, 'origin', 'extracted.json');
      const content = await fs.promises.readFile(extractionPath, 'utf8');
      return JSON.parse(content);
    } catch (_error) {
      return null;
    }
  });
}

function serializeError(error) {
  return new Error(error?.message || 'Unknown error');
}
