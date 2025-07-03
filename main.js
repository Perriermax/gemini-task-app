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
    },
    useContentSize: true // ここを追加
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

  // ウィンドウモード切り替えのIPCハンドラ
  ipcMain.on('toggleWindowMode', (event, mode) => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return;

    const screen = require('electron').screen;
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    if (mode === 'compact') {
      win.setSize(350, height); // サイドバーの幅 + Dockに被らない画面の高さ
      win.setPosition(0, 0); // 左上隅に配置
      win.setAlwaysOnTop(true); // 常に手前に表示
    } else {
      win.setSize(1200, 800); // デフォルトサイズに戻す (拡大)
      win.center(); // 画面中央に配置
      win.setAlwaysOnTop(false); // 常に手前に表示を解除
    }
    console.log(`Window size after toggle (${mode}):`, win.getSize());
    console.log(`Content size after toggle (${mode}):`, win.getContentSize());
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});