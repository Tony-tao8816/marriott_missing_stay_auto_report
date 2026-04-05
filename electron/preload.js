const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopApi', {
  pickPdf: () => ipcRenderer.invoke('dialog:pickPdf'),
  pickWorkspace: () => ipcRenderer.invoke('dialog:pickWorkspace'),
  pickOutputRoot: () => ipcRenderer.invoke('dialog:pickOutputRoot'),
  pickDatabase: () => ipcRenderer.invoke('dialog:pickDatabase'),
  processPdf: (payload) => ipcRenderer.invoke('workflow:processPdf', payload),
  registerEmail: (payload) => ipcRenderer.invoke('workflow:registerEmail', payload),
  openPath: (targetPath) => ipcRenderer.invoke('shell:openPath', targetPath),
  readExtraction: (workspacePath) => ipcRenderer.invoke('workspace:readExtraction', workspacePath),
  readVisibleText: (workspacePath) => ipcRenderer.invoke('workspace:readVisibleText', workspacePath),
  getDefaultDatabasePath: () => ipcRenderer.invoke('database:getDefaultPath'),
  readDatabaseRecords: (databasePath) => ipcRenderer.invoke('database:readRecords', databasePath),
  updateDatabaseRecord: (payload) => ipcRenderer.invoke('database:updateRecord', payload)
});
