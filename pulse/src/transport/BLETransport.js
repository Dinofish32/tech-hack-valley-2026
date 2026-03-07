const { EventEmitter } = require('events');

const SERVICE_UUID       = '12345678-1234-1234-1234-123456789abc';
const CHARACTERISTIC_UUID = '12345678-1234-1234-1234-123456789abd';

let noble;
try {
  noble = require('@abandonware/noble');
} catch (e) {
  noble = null;
}

class BLETransport extends EventEmitter {
  constructor() {
    super();
    this._peripheral = null;
    this._characteristic = null;
    this._connected = false;
  }

  /**
   * Scan for BLE devices advertising the Puls8 service.
   * @param {number} timeoutMs
   * @returns {Promise<Array<{id:string, name:string, rssi:number}>>}
   */
  async scan(timeoutMs = 5000) {
    if (!noble) {
      console.warn('[BLETransport] noble not available — BLE not implemented in this environment');
      return [];
    }

    return new Promise((resolve) => {
      const found = [];

      const onDiscover = (peripheral) => {
        found.push({
          id: peripheral.id,
          name: peripheral.advertisement.localName || 'Unknown',
          rssi: peripheral.rssi,
        });
      };

      noble.on('discover', onDiscover);

      noble.startScanning([], false, (err) => {
        if (err) {
          console.warn('[BLETransport] startScanning error:', err.message);
          noble.removeListener('discover', onDiscover);
          resolve([]);
          return;
        }
      });

      setTimeout(() => {
        noble.stopScanning();
        noble.removeListener('discover', onDiscover);
        resolve(found);
      }, timeoutMs);
    });
  }

  /**
   * Connect to a BLE device by ID.
   * @param {string} deviceId
   */
  async connect(deviceId) {
    if (!noble) {
      console.warn('[BLETransport] noble not available — BLE not implemented');
      return;
    }

    return new Promise((resolve, reject) => {
      const onDiscover = async (peripheral) => {
        if (peripheral.id !== deviceId) return;
        noble.stopScanning();
        noble.removeListener('discover', onDiscover);

        this._peripheral = peripheral;

        peripheral.on('disconnect', () => {
          this._connected = false;
          this._characteristic = null;
          this.emit('disconnect');
        });

        try {
          await peripheral.connectAsync();
          const { characteristics } = await peripheral.discoverSomeServicesAndCharacteristicsAsync(
            [SERVICE_UUID.replace(/-/g, '')],
            [CHARACTERISTIC_UUID.replace(/-/g, '')]
          );

          this._characteristic = characteristics[0] || null;
          this._connected = true;
          this.emit('connect', peripheral.advertisement.localName || deviceId);
          resolve();
        } catch (err) {
          console.error('[BLETransport] connect error:', err.message);
          this.emit('error', err);
          reject(err);
        }
      };

      noble.on('discover', onDiscover);
      noble.startScanning([], false);
    });
  }

  /**
   * Disconnect from current BLE device.
   */
  async disconnect() {
    if (this._peripheral && this._connected) {
      try {
        await this._peripheral.disconnectAsync();
      } catch (err) {
        console.warn('[BLETransport] disconnect error:', err.message);
      }
    }
    this._peripheral = null;
    this._characteristic = null;
    this._connected = false;
  }

  /**
   * Send a binary packet to the connected BLE device.
   * Write without response for lowest latency.
   * @param {Buffer} packet
   */
  send(packet) {
    if (!this._characteristic || !this._connected) return;

    try {
      // Write without response (false = no response needed)
      this._characteristic.write(packet, true, (err) => {
        if (err) {
          console.warn('[BLETransport] send error:', err.message);
          this.emit('error', err);
        }
      });
    } catch (err) {
      console.warn('[BLETransport] send exception:', err.message);
    }
  }

  get isConnected() {
    return this._connected;
  }
}

module.exports = BLETransport;
