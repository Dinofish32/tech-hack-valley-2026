const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const { init: initDb } = require('./db');
const { registerIpcHandlers, setActiveGamePid, setOverlayWindow } = require('./ipc');
const GameDetector = require('./gameDetector');

// Handle Squirrel startup events on Windows
if (require('electron-squirrel-startup')) app.quit();

let mainWindow   = null;
let overlayWin   = null;
let gameDetector = null;
let activeGamePid = null;

function createOverlay() {
  if (overlayWin) return;
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  overlayWin = new BrowserWindow({
    width: 160, height: 44,
    x: width - 172, y: height - 56,
    transparent: true, frame: false,
    alwaysOnTop: true, skipTaskbar: true,
    focusable: false, hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, '../../src/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  overlayWin.setAlwaysOnTop(true, 'screen-saver');
  overlayWin.setIgnoreMouseEvents(true);
  overlayWin.loadURL(MAIN_WINDOW_WEBPACK_ENTRY + '#/overlay');
  overlayWin.on('closed', () => { overlayWin = null; setOverlayWindow(null); });
  setOverlayWindow(overlayWin);
}

function destroyOverlay() {
  if (overlayWin && !overlayWin.isDestroyed()) overlayWin.close();
  overlayWin = null;
  setOverlayWindow(null);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0A0F1E',
    webPreferences: {
      preload: path.join(__dirname, '../../src/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hidden',
    frame: false,
  });

  // Load renderer — webpack dev server in dev, file in prod
  if (MAIN_WINDOW_WEBPACK_ENTRY) {
    mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  }

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    // Init database
    initDb();

    // Create window
    createWindow();

    // Register all IPC handlers (pass mainWindow getter)
    registerIpcHandlers(ipcMain, () => mainWindow);

    // Start game detector
    gameDetector = new GameDetector({ pollIntervalMs: 3000 });
    gameDetector.on('game:detected', ({ processName, profileId, pid }) => {
      activeGamePid = pid || null;
      setActiveGamePid(activeGamePid);
      createOverlay();
      if (mainWindow) mainWindow.webContents.send('game:detected', { processName, profileId, pid });
    });
    gameDetector.on('game:lost', () => {
      activeGamePid = null;
      setActiveGamePid(null);
      destroyOverlay();
    });
    gameDetector.start();
  } catch (err) {
    console.error('[main] startup error:', err.message);
  }
});

app.on('window-all-closed', async () => {
  if (gameDetector) gameDetector.stop();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
