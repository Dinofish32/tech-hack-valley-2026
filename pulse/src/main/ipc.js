const path = require('path');
const fs = require('fs');
const Pipeline = require('../main/pipeline/Pipeline');
const WebSocketTransport = require('../transport/WebSocketTransport');
const BLETransport = require('../transport/BLETransport');
const AudioCapture = require('../main/pipeline/AudioCapture');
const db = require('./db');

let pipeline      = null;
let transport     = null;
let getWindow     = null;
let activeGamePid = null;
let overlayWindow = null;
let motorWindow   = null;

function setOverlayWindow(win) { overlayWindow = win; }
function setMotorWindow(win)   { motorWindow = win; }

/** Called by index.js when GameDetector fires game:detected / game:lost */
function setActiveGamePid(pid) {
  activeGamePid = pid || null;
}

function send(channel, data) {
  const win = getWindow();
  if (win && !win.isDestroyed()) win.webContents.send(channel, data);
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.webContents.send(channel, data);
  if (motorWindow && !motorWindow.isDestroyed()) motorWindow.webContents.send(channel, data);
}

/**
 * Register all IPC handlers.
 * @param {Electron.IpcMain} ipcMain
 * @param {Function} windowGetter () => BrowserWindow
 */
function registerIpcHandlers(ipcMain, windowGetter) {
  getWindow = windowGetter;

  // ── Pipeline ────────────────────────────────────────────────────────────

  ipcMain.handle('pipeline:start', async (_event, config) => {
    try {
      if (pipeline) {
        await pipeline.stop();
        pipeline = null;
      }
      pipeline = new Pipeline({ ...(config || {}), gamePid: activeGamePid });

      pipeline.on('command', (command) => {
        send('pipeline:command', command);
        if (transport) {
          try {
            const pkt = require('../main/pipeline/MotorCommandGenerator').prototype.generatePacket
              ? null
              : null;
            // Use the motor command generator's packet builder
            const { buildPacket } = require('../shared/packetSchema');
            transport.send(buildPacket(command));
          } catch (err) {
            console.warn('[ipc] transport send error:', err.message);
          }
        }
      });

      pipeline.on('event', (event) => {
        send('pipeline:event', event);
        // Persist to DB asynchronously
        try {
          db.insertEvent({
            ...event,
            sessionId: 'current',
            transmitted: 1,
            latencyMs: 0,
          });
        } catch (e) {}
      });

      pipeline.on('metrics', (metrics) => {
        send('pipeline:metrics', metrics);
      });

      pipeline.on('level', (level) => {
        send('pipeline:level', level);
      });

      pipeline.on('error', (err) => {
        console.error('[pipeline] error:', err.message);
        send('pipeline:metrics', { error: err.message });
      });

      await pipeline.start();
      return { ok: true };
    } catch (err) {
      console.error('[ipc] pipeline:start error:', err.message);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('pipeline:stop', async () => {
    try {
      if (pipeline) {
        await pipeline.stop();
        pipeline = null;
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('pipeline:getMetrics', () => {
    if (!pipeline) return { avgLatencyMs: 0, p95LatencyMs: 0, eventsPerSec: 0, suppressedPerSec: 0, onsetRate: 0 };
    return pipeline.getMetrics();
  });

  ipcMain.handle('pipeline:updateConfig', async (_event, partialConfig) => {
    try {
      if (pipeline) pipeline.updateConfig(partialConfig);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // ── Transport ────────────────────────────────────────────────────────────

  ipcMain.handle('transport:connect', async (_event, { type, host, port, deviceId }) => {
    try {
      if (transport) {
        await transport.stop?.();
        await transport.disconnect?.();
        transport = null;
      }

      if (type === 'WEBSOCKET') {
        transport = new WebSocketTransport({ port: port || 8765 });
        transport.on('connect', (addr) => send('transport:status', { connected: true, type: 'WEBSOCKET', address: addr, latencyMs: 0 }));
        transport.on('disconnect', () => send('transport:status', { connected: false, type: 'NONE', latencyMs: 0 }));
        transport.on('error', (e) => console.warn('[transport] ws error:', e.message));
        await transport.start();
      } else if (type === 'BLE') {
        transport = new BLETransport();
        transport.on('connect', () => send('transport:status', { connected: true, type: 'BLE', latencyMs: 0 }));
        transport.on('disconnect', () => send('transport:status', { connected: false, type: 'NONE', latencyMs: 0 }));
        if (deviceId) await transport.connect(deviceId);
      }

      return { ok: true };
    } catch (err) {
      console.error('[ipc] transport:connect error:', err.message);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('transport:disconnect', async () => {
    try {
      if (transport) {
        await transport.stop?.();
        await transport.disconnect?.();
        transport = null;
      }
      send('transport:status', { connected: false, type: 'NONE', latencyMs: 0 });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('transport:scan', async () => {
    try {
      const ble = new BLETransport();
      const devices = await ble.scan(5000);
      return devices;
    } catch (err) {
      console.warn('[ipc] transport:scan error:', err.message);
      return [];
    }
  });

  // ── Profiles ─────────────────────────────────────────────────────────────

  ipcMain.handle('profiles:list', () => {
    try {
      return db.listProfiles().map(p => ({
        ...p,
        priorityMap: JSON.parse(p.priorityMap || '{}'),
        enabledCats: JSON.parse(p.enabledCats || '[]'),
        patterns: JSON.parse(p.patterns || '{}'),
      }));
    } catch (err) {
      console.error('[ipc] profiles:list error:', err.message);
      return [];
    }
  });

  ipcMain.handle('profiles:save', (_event, profile) => {
    try {
      db.saveProfile(profile);
      return { ok: true };
    } catch (err) {
      console.error('[ipc] profiles:save error:', err.message);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('profiles:delete', (_event, { id }) => {
    try {
      db.deleteProfile(id);
      return { ok: true };
    } catch (err) {
      console.error('[ipc] profiles:delete error:', err.message);
      return { ok: false, error: err.message };
    }
  });

  // ── Audio devices ─────────────────────────────────────────────────────────

  ipcMain.handle('audio:listDevices', async () => {
    try {
      const capture = new AudioCapture({});
      return await capture.listDevices();
    } catch (err) {
      console.warn('[ipc] audio:listDevices error:', err.message);
      return [];
    }
  });

  // ── Calibration ───────────────────────────────────────────────────────────

  ipcMain.handle('calibration:fire', async (_event, { motor, intensity, waveform }) => {
    try {
      if (!transport) return { ok: false, error: 'No transport connected' };
      const { buildPacket } = require('../shared/packetSchema');
      const motors = { N: 0, E: 0, S: 0, W: 0 };
      motors[motor] = Math.round(Math.max(0, Math.min(255, intensity)));
      const pkt = buildPacket({ motors, waveform: waveform || 'ALERT', durationMs: 200 });
      transport.send(pkt);
      return { ok: true };
    } catch (err) {
      console.error('[ipc] calibration:fire error:', err.message);
      return { ok: false, error: err.message };
    }
  });

  // ── Events ────────────────────────────────────────────────────────────────

  ipcMain.handle('events:query', (_event, { sessionId, filters }) => {
    try {
      return db.queryEvents({ sessionId, filters });
    } catch (err) {
      console.error('[ipc] events:query error:', err.message);
      return [];
    }
  });

  ipcMain.handle('events:export', async (_event, { sessionId }) => {
    try {
      const { dialog } = require('electron');
      const events = db.queryEvents({ sessionId, filters: {} });
      const csv = [
        'id,timestamp,category,direction,confidence,priority,transmitted,latencyMs',
        ...events.map(e =>
          `${e.id},${e.timestamp},${e.category},${e.direction},${e.confidence},${e.priority},${e.transmitted},${e.latencyMs}`
        ),
      ].join('\n');

      const { filePath } = await dialog.showSaveDialog({
        defaultPath: `pulse-events-${sessionId || 'all'}.csv`,
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      });

      if (filePath) {
        fs.writeFileSync(filePath, csv, 'utf8');
        return { filePath };
      }
      return { filePath: null };
    } catch (err) {
      console.error('[ipc] events:export error:', err.message);
      return { filePath: null };
    }
  });
}

module.exports = { registerIpcHandlers, setActiveGamePid, setOverlayWindow, setMotorWindow };
