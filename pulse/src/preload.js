const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  pipeline: {
    start: (config) => ipcRenderer.invoke('pipeline:start', config),
    stop: () => ipcRenderer.invoke('pipeline:stop'),
    getMetrics: () => ipcRenderer.invoke('pipeline:getMetrics'),
    updateConfig: (cfg) => ipcRenderer.invoke('pipeline:updateConfig', cfg),
    onEvent: (cb) => ipcRenderer.on('pipeline:event', (_e, d) => cb(d)),
    onCommand: (cb) => ipcRenderer.on('pipeline:command', (_e, d) => cb(d)),
    onMetrics: (cb) => ipcRenderer.on('pipeline:metrics', (_e, d) => cb(d)),
    onLevel: (cb) => ipcRenderer.on('pipeline:level', (_e, d) => cb(d)),
    removeAllListeners: (ch) => ipcRenderer.removeAllListeners(ch),
  },
  transport: {
    connect: (opts) => ipcRenderer.invoke('transport:connect', opts),
    disconnect: () => ipcRenderer.invoke('transport:disconnect'),
    scan: () => ipcRenderer.invoke('transport:scan'),
    onStatus: (cb) => ipcRenderer.on('transport:status', (_e, d) => cb(d)),
  },
  profiles: {
    list: () => ipcRenderer.invoke('profiles:list'),
    save: (p) => ipcRenderer.invoke('profiles:save', p),
    delete: (id) => ipcRenderer.invoke('profiles:delete', { id }),
  },
  audio: {
    listDevices: () => ipcRenderer.invoke('audio:listDevices'),
  },
  calibration: {
    fire: (opts) => ipcRenderer.invoke('calibration:fire', opts),
  },
  events: {
    query: (opts) => ipcRenderer.invoke('events:query', opts),
    export: (opts) => ipcRenderer.invoke('events:export', opts),
  },
  game: {
    onDetected: (cb) => ipcRenderer.on('game:detected', (_e, d) => cb(d)),
  },
});
