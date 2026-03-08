const { EventEmitter } = require('events');
const db = require('./db');

// Built-in games detected automatically — no user profile required
const BUILT_IN_GAMES = [
  { id: 'builtin-valorant', process: 'VALORANT-Win64-Shipping.exe', name: 'Valorant' },
];

class GameDetector extends EventEmitter {
  /**
   * @param {{ pollIntervalMs?: number }} opts
   */
  constructor({ pollIntervalMs = 3000 } = {}) {
    super();
    this.pollIntervalMs = pollIntervalMs;
    this._timer = null;
    this._lastDetected = null;
  }

  start() {
    if (this._timer) return;
    this._poll();
    this._timer = setInterval(() => this._poll(), this.pollIntervalMs);
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  async _poll() {
    try {
      const processes = await this._getProcessList();

      // Check built-in games first (no profile required)
      for (const game of BUILT_IN_GAMES) {
        const processName = game.process.toLowerCase();
        const match = processes.find(p => (p.name || '').toLowerCase() === processName);
        if (match) {
          const key = `builtin:${processName}`;
          if (this._lastDetected !== key) {
            this._lastDetected = key;
            this.emit('game:detected', {
              gameName: game.name,
              processName: game.process,
              profileId: null,
              pid: match.pid || null,
            });
            console.log(`[GameDetector] ${game.name} detected — PID ${match.pid}`);
          }
          return;
        }
      }

      // Then check user profiles
      const profiles = db.listProfiles();
      for (const profile of profiles) {
        const processName = (profile.process || '').toLowerCase();
        const match = processes.find(p => (p.name || '').toLowerCase() === processName);
        if (match) {
          const key = `${profile.id}:${processName}`;
          if (this._lastDetected !== key) {
            this._lastDetected = key;
            this.emit('game:detected', {
              gameName: profile.name,
              processName: profile.process,
              profileId: profile.id,
              pid: match.pid || null,
            });
            console.log(`[GameDetector] Game detected: ${profile.process} PID=${match.pid} (profile: ${profile.name})`);
          }
          return;
        }
      }

      // No match found — reset
      if (this._lastDetected !== null) {
        this._lastDetected = null;
        this.emit('game:lost');
      }
    } catch (err) {
      console.error('[GameDetector] poll error:', err.message);
    }
  }

  async _getProcessList() {
    try {
      // ps-list v8+ is ESM, use dynamic import
      const mod = await import('ps-list');
      const list = mod.default || mod;
      return await list();
    } catch (err) {
      console.warn('[GameDetector] ps-list unavailable:', err.message);
      return [];
    }
  }
}

module.exports = GameDetector;
