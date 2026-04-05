const path = require('node:path');
const fs = require('node:fs');
const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const { processPdfWorkflow } = require('../src/workflows/process-pdf');
const { registerEmailWorkflow } = require('../src/workflows/register-email');
const { DATABASE_FILE_NAME, readWorkflowRecords, updateWorkflowRecord } = require('../src/storage/local-database');

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

  ipcMain.handle('dialog:pickDatabase', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Local Database',
      properties: ['openFile'],
      filters: [
        { name: 'SQLite Database', extensions: ['sqlite', 'db'] },
        { name: 'All Files', extensions: ['*'] }
      ]
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

  ipcMain.handle('database:getDefaultPath', async () => {
    return path.join(app.getPath('documents'), 'marriott_missing_stay_auto_report', DATABASE_FILE_NAME);
  });

  ipcMain.handle('database:readRecords', async (_event, databasePath) => {
    try {
      const resolvedPath = databasePath || path.join(app.getPath('documents'), 'marriott_missing_stay_auto_report', DATABASE_FILE_NAME);
      return await readWorkflowRecords(resolvedPath);
    } catch (error) {
      throw serializeError(error);
    }
  });

  ipcMain.handle('database:updateRecord', async (_event, payload) => {
    try {
      const resolvedPath = payload?.databasePath || path.join(app.getPath('documents'), 'marriott_missing_stay_auto_report', DATABASE_FILE_NAME);
      return await updateWorkflowRecord(
        resolvedPath,
        payload?.workspaceDirectory,
        payload?.field,
        payload?.value ?? ''
      );
    } catch (error) {
      throw serializeError(error);
    }
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

  ipcMain.handle('workspace:readVisibleText', async (_event, workspacePath) => {
    try {
      const visibleTextPath = path.join(workspacePath, 'origin', 'visible-text.json');
      const content = await fs.promises.readFile(visibleTextPath, 'utf8');
      return JSON.parse(content);
    } catch (_error) {
      return null;
    }
  });
}

function serializeError(error) {
  return new Error(error?.message || 'Unknown error');
}
