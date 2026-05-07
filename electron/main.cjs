const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV !== 'production';

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    // icon: path.join(__dirname, '../public/favicon.ico')
  });

  if (isDev) {
    // In development mode, load the vite dev server URL
    mainWindow.loadURL('http://localhost:3000');
    // Open the DevTools.
    // mainWindow.webContents.openDevTools();
  } else {
    // In production mode, load the built index.html
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
