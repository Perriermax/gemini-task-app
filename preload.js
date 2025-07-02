const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getData: () => ipcRenderer.invoke('get-data'),
  setData: (data) => ipcRenderer.send('set-data', data)
});