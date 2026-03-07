const FFT = require('fft.js');

class OnsetDetector {
  /**
   * @param {{ threshold?: number, debounceMs?: number, sampleRate?: number }} opts
   */
  constructor({ threshold = 0.3, debounceMs = 30, sampleRate = 48000 } = {}) {
    this.threshold = threshold;
    this.debounceMs = debounceMs;
    this.sampleRate = sampleRate;
    this._prevMagnitude = null;
    this._fluxHistory = []; // rolling 2-second history of flux values
    this._lastOnsetTime = -Infinity;
    this._fftSize = 1024;
    this._fft = new FFT(this._fftSize);
  }

  /**
   * Process one AudioBuffer and return any detected onsets.
   * @param {{ left: Float32Array, right: Float32Array, timestamp: number }} audioBuffer
   * @returns {Array<{ detected: boolean, timestamp: number, frame: Float32Array }>}
   */
  process(audioBuffer) {
    const { left, right, timestamp } = audioBuffer;
    const results = [];

    // Mix to mono
    const len = Math.min(left.length, right.length);
    const mono = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      mono[i] = (left[i] + right[i]) * 0.5;
    }

    // Process in fftSize chunks
    for (let start = 0; start + this._fftSize <= len; start += this._fftSize) {
      const frame = mono.subarray(start, start + this._fftSize);
      const magnitude = this._computeMagnitude(frame);
      const flux = this._spectralFlux(magnitude);
      this._prevMagnitude = magnitude;

      // Maintain rolling 2-second history (~2s worth of frames)
      this._fluxHistory.push(flux);
      const maxHistory = Math.ceil((2 * this.sampleRate) / this._fftSize);
      if (this._fluxHistory.length > maxHistory) {
        this._fluxHistory.shift();
      }

      const median = this._median(this._fluxHistory);
      const normalizedFlux = median > 0 ? flux / median : flux;

      const now = timestamp + (start / this.sampleRate) * 1000;
      const debounceOk = (now - this._lastOnsetTime) >= this.debounceMs;

      if (normalizedFlux > this.threshold && debounceOk && this._prevMagnitude !== null) {
        this._lastOnsetTime = now;
        results.push({ detected: true, timestamp: now, frame: Float32Array.from(frame) });
      }
    }

    return results;
  }

  /**
   * Update detection threshold (0.0–1.0).
   * @param {number} value
   */
  setThreshold(value) {
    this.threshold = Math.max(0, Math.min(1, value));
  }

  reset() {
    this._prevMagnitude = null;
    this._fluxHistory = [];
    this._lastOnsetTime = -Infinity;
  }

  /**
   * Compute magnitude spectrum of a frame via FFT.
   * @param {Float32Array} frame
   * @returns {Float32Array}
   */
  _computeMagnitude(frame) {
    const input = new Array(this._fftSize * 2).fill(0);
    for (let i = 0; i < this._fftSize; i++) {
      input[i * 2] = frame[i];
    }
    const out = this._fft.createComplexArray();
    this._fft.transform(out, input);
    const mag = new Float32Array(this._fftSize / 2 + 1);
    for (let k = 0; k <= this._fftSize / 2; k++) {
      const re = out[k * 2];
      const im = out[k * 2 + 1];
      mag[k] = Math.sqrt(re * re + im * im);
    }
    return mag;
  }

  /**
   * Compute spectral flux: sum of positive differences from previous frame.
   * @param {Float32Array} magnitude
   * @returns {number}
   */
  _spectralFlux(magnitude) {
    if (!this._prevMagnitude) return 0;
    let flux = 0;
    for (let k = 0; k < magnitude.length; k++) {
      const diff = magnitude[k] - this._prevMagnitude[k];
      if (diff > 0) flux += diff;
    }
    return flux;
  }

  /**
   * Compute median of an array.
   * @param {number[]} arr
   * @returns {number}
   */
  _median(arr) {
    if (arr.length === 0) return 0;
    const sorted = arr.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }
}

module.exports = OnsetDetector;
