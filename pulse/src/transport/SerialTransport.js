const { EventEmitter } = require('events');

/**
 * SerialTransport — sends binary packets to the ESP32 dongle over USB serial.
 * The dongle forwards them to the headband via ESP-NOW.
 *
 * Uses the `serialport` npm package (optional dependency).
 * Install: npm install serialport --ignore-scripts
 */
class SerialTransport extends EventEmitter {
  /**
   * @param {{ path: string, baudRate?: number }} opts
   *   path     — COM port on Windows (e.g. 'COM3') or /dev/ttyUSB0 on Linux
   *   baudRate — must match dongle firmware BAUD (default 115200)
   */
  constructor({ path, baudRate = 115200 } = {}) {
    super();
    this._path = path;
    this._baudRate = baudRate;
    this._port = null;
  }

  /**
   * Open the serial port.
   */
  async start() {
    const { SerialPort } = require('serialport');

    return new Promise((resolve, reject) => {
      this._port = new SerialPort(
        { path: this._path, baudRate: this._baudRate },
        (err) => {
          if (err) {
            console.error('[SerialTransport] Open error:', err.message);
            reject(err);
            return;
          }
          console.log(`[SerialTransport] Opened ${this._path} @ ${this._baudRate} baud`);
          this.emit('connect', this._path);
          resolve();
        }
      );

      this._port.on('close', () => {
        console.log('[SerialTransport] Port closed');
        this.emit('disconnect');
      });

      this._port.on('error', (err) => {
        console.warn('[SerialTransport] Error:', err.message);
        this.emit('error', err);
      });
    });
  }

  /**
   * Send an 8-byte binary packet to the dongle.
   * @param {Buffer} packet
   */
  send(packet) {
    if (!this._port || !this._port.isOpen) return;
    this._port.write(packet, (err) => {
      if (err) console.warn('[SerialTransport] Write error:', err.message);
    });
  }

  /**
   * Close the serial port.
   */
  async stop() {
    if (this._port && this._port.isOpen) {
      await new Promise((resolve) => this._port.close(resolve));
    }
    this._port = null;
  }

  /**
   * List available serial ports. Use this to find which COM port is the dongle.
   * @returns {Promise<Array<{ path: string, manufacturer: string }>>}
   */
  static async listPorts() {
    const { SerialPort } = require('serialport');
    return SerialPort.list();
  }
}

module.exports = SerialTransport;
