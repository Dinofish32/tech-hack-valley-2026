const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { init: initDb } = require('./db');
const { registerIpcHandlers, setActiveGamePid, setActiveGameInfo, setOverlayWindow, setMotorWindow } = require('./ipc');
const GameDetector = require('./gameDetector');

// Handle Squirrel startup events on Windows
if (require('electron-squirrel-startup')) app.quit();

let mainWindow    = null;
let overlayWin    = null;
let motorWin      = null;
let gameDetector  = null;
let activeGamePid = null;

function overlayPositionsPath() {
  return path.join(app.getPath('userData'), 'overlay-positions.json');
}
function loadOverlayPositions() {
  try {
    const data = fs.readFileSync(overlayPositionsPath(), 'utf8');
    return JSON.parse(data);
  } catch { return {}; }
}
function saveOverlayPositions() {
  try {
    const pos = {};
    if (overlayWin && !overlayWin.isDestroyed()) pos.audio = overlayWin.getBounds();
    if (motorWin   && !motorWin.isDestroyed())   pos.motor = motorWin.getBounds();
    fs.writeFileSync(overlayPositionsPath(), JSON.stringify(pos));
  } catch { }
}

function makeOverlayWindow(url, x, y, width, height) {
  const win = new BrowserWindow({
    width, height, x, y,
    transparent: true, frame: false,
    backgroundColor: '#00000000',
    alwaysOnTop: true, skipTaskbar: true,
    focusable: false, hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, '../../src/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true);
  win.loadURL(url);
  return win;
}

function createOverlays() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const MOTOR_W = 142, MOTOR_H = 142;
  const AUDIO_W = 210, AUDIO_H = 34;

  const saved = loadOverlayPositions();
  const audioPos = saved.audio || { x: width - AUDIO_W, y: 0 };
  const motorPos = saved.motor || { x: width - MOTOR_W - AUDIO_W - 8, y: 0 };

  if (!overlayWin) {
    overlayWin = makeOverlayWindow(
      MAIN_WINDOW_WEBPACK_ENTRY + '#/overlay',
      audioPos.x, audioPos.y, AUDIO_W, AUDIO_H
    );
    overlayWin.on('closed', () => { overlayWin = null; setOverlayWindow(null); });
    setOverlayWindow(overlayWin);
  }

  if (!motorWin) {
    motorWin = makeOverlayWindow(
      MAIN_WINDOW_WEBPACK_ENTRY + '#/motor-overlay',
      motorPos.x, motorPos.y, MOTOR_W, MOTOR_H
    );
    motorWin.on('closed', () => { motorWin = null; setMotorWindow(null); });
    setMotorWindow(motorWin);
  }
}

function destroyOverlays() {
  if (overlayWin && !overlayWin.isDestroyed()) overlayWin.close();
  overlayWin = null;
  setOverlayWindow(null);
  if (motorWin && !motorWin.isDestroyed()) motorWin.close();
  motorWin = null;
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

    // Overlay positioning
    ipcMain.handle('overlay:setPosition', (_e, { audio, motor }) => {
      if (audio && overlayWin && !overlayWin.isDestroyed()) overlayWin.setPosition(audio.x, audio.y);
      if (motor && motorWin  && !motorWin.isDestroyed())   motorWin.setPosition(motor.x, motor.y);
      saveOverlayPositions();
    });
    ipcMain.handle('overlay:getPosition', () => {
      return {
        audio: overlayWin && !overlayWin.isDestroyed() ? overlayWin.getPosition() : null,
        motor: motorWin   && !motorWin.isDestroyed()   ? motorWin.getPosition()   : null,
      };
    });

    // Always create overlays so user can position them at any time
    createOverlays();

    // Overlay move mode IPC
    ipcMain.handle('overlay:startMove', () => {
      [overlayWin, motorWin].forEach(win => {
        if (win && !win.isDestroyed()) {
          win.setIgnoreMouseEvents(false);
          win.setFocusable(true);
          win.webContents.send('overlay:dragMode', true);
        }
      });
    });
    ipcMain.handle('overlay:stopMove', () => {
      [overlayWin, motorWin].forEach(win => {
        if (win && !win.isDestroyed()) {
          win.setIgnoreMouseEvents(true);
          win.setFocusable(false);
          win.webContents.send('overlay:dragMode', false);
        }
      });
      saveOverlayPositions();
    });

    // Start game detector
    gameDetector = new GameDetector({ pollIntervalMs: 3000 });
    gameDetector.on('game:detected', ({ gameName, processName, profileId, pid }) => {
      activeGamePid = pid || null;
      setActiveGamePid(activeGamePid);
      setActiveGameInfo({ gameName: gameName || '', processName: processName || '' });
      createOverlays();
      if (mainWindow) mainWindow.webContents.send('game:detected', { gameName, processName, profileId, pid });
    });
    gameDetector.on('game:lost', () => {
      activeGamePid = null;
      setActiveGamePid(null);
      destroyOverlays();
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
