const { EventEmitter } = require('events');
const ProcessAudioCapture = require('../audio/ProcessAudioCapture');

let portaudio;
try {
  portaudio = require('node-portaudio');
} catch (e) {
  portaudio = null;
}

class AudioCapture extends EventEmitter {
  /**
   * @param {{ sampleRate?: number, bufferSize?: number, deviceIndex?: number|null, gamePid?: number|null }} opts
   */
  constructor({ sampleRate = 48000, bufferSize = 512, deviceIndex = null, gamePid = null } = {}) {
    super();
    this.sampleRate = sampleRate;
    this.bufferSize = bufferSize;
    this.deviceIndex = deviceIndex;
    this.gamePid = gamePid;
    this._stream = null;
    this._processCapture = null;
    this._running = false;
  }

  /**
   * List available audio devices.
   * @returns {Promise<Array>}
   */
  async listDevices() {
    if (!portaudio) {
      console.warn('[AudioCapture] node-portaudio not available — returning empty device list');
      return [];
    }
    try {
      const devices = portaudio.getDevices();
      return devices.map((d, i) => ({
        index: i,
        name: d.name,
        maxInputChannels: d.maxInputChannels,
        maxOutputChannels: d.maxOutputChannels,
        defaultSampleRate: d.defaultSampleRate,
      }));
    } catch (err) {
      console.error('[AudioCapture] listDevices error:', err.message);
      return [];
    }
  }

  /**
   * Start loopback capture. Emits 'data' with AudioBuffer every bufferSize samples.
   * If gamePid is set and wasapi_capture.exe is available, uses process-level
   * audio isolation. Otherwise falls back to portaudio or synthetic audio.
   */
  async start() {
    if (this._running) return;

    // --- Per-process capture (preferred) ---
    if (this.gamePid && ProcessAudioCapture.isAvailable()) {
      console.log(`[AudioCapture] Using process loopback for PID ${this.gamePid}`);
      this._processCapture = new ProcessAudioCapture({ pid: this.gamePid });
      this._processCapture.on('data', (buf) => {
        this.sampleRate = buf.sampleRate;
        this.emit('data', buf);
      });
      this._processCapture.on('error', (err) => this.emit('error', err));
      this._processCapture.on('stopped', (code) => {
        console.warn(`[AudioCapture] wasapi_capture.exe exited (code ${code})`);
      });
      this._processCapture.start();
      this._running = true;
      return;
    }

    if (!portaudio) {
      console.warn('[AudioCapture] node-portaudio not available — emitting synthetic audio for development');
      this._running = true;
      this._startSynthetic();
      return;
    }

    try {
      const streamOptions = {
        channelCount: 2,
        sampleFormat: portaudio.SampleFormat32Bit,
        sampleRate: this.sampleRate,
        framesPerBuffer: this.bufferSize,
        loopback: true, // WASAPI loopback on Windows
      };

      if (this.deviceIndex !== null) {
        streamOptions.deviceId = this.deviceIndex;
      }

      // macOS: check for BlackHole
      if (process.platform === 'darwin') {
        const devices = await this.listDevices();
        const blackhole = devices.find(d => d.name.toLowerCase().includes('blackhole'));
        if (!blackhole) {
          this.emit('error', new Error('BlackHole virtual audio device not found. Please install BlackHole for macOS loopback capture.'));
          return;
        }
        if (this.deviceIndex === null) {
          streamOptions.deviceId = blackhole.index;
        }
      }

      this._stream = new portaudio.AudioIO({
        inOptions: streamOptions,
      });

      this._stream.on('data', (rawBuffer) => {
        try {
          const samples = new Float32Array(rawBuffer.buffer, rawBuffer.byteOffset, rawBuffer.byteLength / 4);
          const frameCount = Math.floor(samples.length / 2);
          const left = new Float32Array(frameCount);
          const right = new Float32Array(frameCount);
          for (let i = 0; i < frameCount; i++) {
            left[i] = samples[i * 2];
            right[i] = samples[i * 2 + 1];
          }
          /** @type {import('../../shared/types').AudioBuffer} */
          const audioBuffer = {
            left,
            right,
            sampleRate: this.sampleRate,
            timestamp: Date.now(),
          };
          this.emit('data', audioBuffer);
        } catch (err) {
          this.emit('error', err);
        }
      });

      this._stream.on('error', (err) => {
        this.emit('error', err);
      });

      this._stream.start();
      this._running = true;
    } catch (err) {
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Stop capture.
   */
  async stop() {
    this._running = false;
    if (this._processCapture) {
      this._processCapture.stop();
      this._processCapture = null;
    }
    if (this._syntheticTimer) {
      clearInterval(this._syntheticTimer);
      this._syntheticTimer = null;
    }
    if (this._stream) {
      try {
        this._stream.quit();
      } catch (e) {
        // ignore
      }
      this._stream = null;
    }
  }

  /**
   * Emit synthetic silence/noise for dev environments without portaudio.
   * @private
   */
  _startSynthetic() {
    const intervalMs = Math.floor((this.bufferSize / this.sampleRate) * 1000);
    this._syntheticTimer = setInterval(() => {
      if (!this._running) return;
      const left = new Float32Array(this.bufferSize);
      const right = new Float32Array(this.bufferSize);
      // emit silence (zeros)
      this.emit('data', { left, right, sampleRate: this.sampleRate, timestamp: Date.now() });
    }, intervalMs || 10);
  }
}

module.exports = AudioCapture;
