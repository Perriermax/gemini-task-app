const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Storeの初期化を非同期で行う
let store;
async function initializeStore() {
  const { default: Store } = await import('electron-store');
  store = new Store();
}

function createWindow () {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadFile('index.html');

  // デベロッパーツールを自動で開く
  win.webContents.openDevTools();

  // デベロッパーツールを自動で開く
  win.webContents.openDevTools();
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// アプリの準備ができてからウィンドウを作成
app.whenReady().then(async () => {
  await initializeStore();

  // IPCハンドラの設定
  ipcMain.handle('get-data', () => {
    return store.get('appData', { tasks: [], pomodoroState: {} });
  });
  ipcMain.on('set-data', (event, data) => {
    store.set('appData', data);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});