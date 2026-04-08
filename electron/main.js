const path = require('node:path');
const fs = require('node:fs');
const { Worker } = require('node:worker_threads');
const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const { uploadIdentityDocumentWorkflow } = require('../src/workflows/upload-identity-document');
const { registerEmailWorkflow } = require('../src/workflows/register-email');
const { registerMarriottAccountWorkflow } = require('../src/workflows/register-marriott-account');
const { requestMarriottMissingStayWorkflow } = require('../src/workflows/request-marriott-missing-stay');
const { DATABASE_FILE_NAME, importWorkflowJson, readWorkflowRecords, updateWorkflowRecord } = require('../src/storage/local-database');

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

  ipcMain.handle('dialog:pickIdentityDocument', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Identity Document',
      properties: ['openFile'],
      filters: [
        { name: 'Documents', extensions: ['pdf', 'png', 'jpg', 'jpeg', 'heic', 'webp'] },
        { name: 'All Files', extensions: ['*'] }
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
      return await runProcessPdfWorker({
        pdfPath: payload.pdfPath,
        outputRoot: payload.outputRoot || undefined
      });
    } catch (error) {
      throw serializeError(error);
    }
  });

  ipcMain.handle('workflow:uploadIdentityDocument', async (_event, payload) => {
    try {
      return await uploadIdentityDocumentWorkflow({
        workspacePath: payload.workspacePath,
        sourceFilePath: payload.sourceFilePath
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
        mailboxEmail: payload.mailboxEmail || undefined,
        mailDomain: payload.mailDomain,
        notifyRecipient: payload.notifyRecipient
      });
    } catch (error) {
      throw serializeError(error);
    }
  });

  ipcMain.handle('workflow:registerMarriottAccount', async (_event, payload) => {
    try {
      return await registerMarriottAccountWorkflow({
        workspacePath: payload.workspacePath,
        databasePath: payload.databasePath || undefined,
        opencliCommand: payload.opencliCommand || 'opencli',
        country: payload.country || 'USA',
        rememberMe: payload.rememberMe ?? false,
        marketingEmails: payload.marketingEmails ?? true,
        incognito: payload.incognito ?? false
      });
    } catch (error) {
      throw serializeError(error);
    }
  });

  ipcMain.handle('workflow:requestMarriottMissingStay', async (_event, payload) => {
    try {
      return await requestMarriottMissingStayWorkflow({
        workspacePath: payload.workspacePath,
        databasePath: payload.databasePath || undefined,
        opencliCommand: payload.opencliCommand || 'opencli',
        thirdPartyBooking: payload.thirdPartyBooking || 'no',
        billCopy: payload.billCopy || 'digital',
        comments: payload.comments || 'Please credit this stay',
        incognito: payload.incognito ?? false
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

  ipcMain.handle('database:importJson', async (_event, payload) => {
    try {
      const resolvedPath = payload?.databasePath || path.join(app.getPath('documents'), 'marriott_missing_stay_auto_report', DATABASE_FILE_NAME);
      return await importWorkflowJson(resolvedPath, payload?.json);
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

function runProcessPdfWorker(payload) {
  return new Promise((resolve, reject) => {
    const workerPath = path.join(__dirname, 'workers', 'process-pdf-worker.js');
    const worker = new Worker(workerPath, {
      workerData: payload
    });

    let settled = false;

    worker.once('message', (message) => {
      settled = true;
      if (message?.status === 'ok') {
        resolve(message.result);
        return;
      }

      reject(new Error(message?.message || 'Unknown worker error'));
    });

    worker.once('error', (error) => {
      settled = true;
      reject(error);
    });

    worker.once('exit', (code) => {
      if (!settled && code !== 0) {
        reject(new Error(`PDF worker exited with code ${code}`));
      }
    });
  });
}
