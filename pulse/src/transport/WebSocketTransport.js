const { EventEmitter } = require('events');
const { WebSocketServer } = require('ws');

const MAX_CONSECUTIVE_FAILURES = 5;

class WebSocketTransport extends EventEmitter {
  /**
   * @param {{ port?: number }} opts
   */
  constructor({ port = 8765 } = {}) {
    super();
    this.port = port;
    this._wss = null;
    this._clients = new Set();
    this._failureCount = 0;
  }

  /**
   * Start WebSocket server on localhost:port.
   */
  async start() {
    return new Promise((resolve, reject) => {
      try {
        this._wss = new WebSocketServer({ port: this.port, host: '0.0.0.0' });

        this._wss.on('listening', () => {
          console.log(`[WebSocketTransport] Listening on port ${this.port}`);
          resolve();
        });

        this._wss.on('connection', (ws, req) => {
          const address = req.socket.remoteAddress || 'unknown';
          this._clients.add(ws);
          this._failureCount = 0;
          console.log(`[WebSocketTransport] Client connected: ${address}`);
          this.emit('connect', address);

          ws.on('close', () => {
            this._clients.delete(ws);
            console.log(`[WebSocketTransport] Client disconnected: ${address}`);
            this.emit('disconnect', address);
          });

          ws.on('error', (err) => {
            this._clients.delete(ws);
            console.warn(`[WebSocketTransport] Client error (${address}):`, err.message);
            this.emit('error', err);
          });
        });

        this._wss.on('error', (err) => {
          console.error('[WebSocketTransport] Server error:', err.message);
          this.emit('error', err);
          reject(err);
        });
      } catch (err) {
        console.error('[WebSocketTransport] start error:', err.message);
        reject(err);
      }
    });
  }

  /**
   * Stop the WebSocket server.
   */
  async stop() {
    return new Promise((resolve) => {
      for (const client of this._clients) {
        try { client.terminate(); } catch (_) {}
      }
      this._clients.clear();

      if (this._wss) {
        this._wss.close(() => {
          this._wss = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Broadcast binary packet to all connected clients.
   * @param {Buffer} packet
   */
  send(packet) {
    if (this._clients.size === 0) return; // drop silently if no clients

    for (const client of this._clients) {
      try {
        if (client.readyState === 1 /* OPEN */) {
          client.send(packet, { binary: true });
          this._failureCount = 0;
        }
      } catch (err) {
        console.warn('[WebSocketTransport] send error:', err.message);
        this._failureCount++;
        if (this._failureCount >= MAX_CONSECUTIVE_FAILURES) {
          this._failureCount = 0;
          this.emit('disconnect', 'consecutive-failures');
        }
      }
    }
  }

  /**
   * Number of currently connected clients.
   * @returns {number}
   */
  get connectedCount() {
    return this._clients.size;
  }
}

module.exports = WebSocketTransport;
