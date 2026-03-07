const { Direction } = require('../../shared/constants');

class DirectionDecoder {
  /**
   * @param {{ hfThreshold?: number, hfBandLow?: number, hfBandHigh?: number, sampleRate?: number }} opts
   */
  constructor({ hfThreshold = 0.65, hfBandLow = 8000, hfBandHigh = 12000, sampleRate = 48000 } = {}) {
    this.hfThreshold = hfThreshold;
    this.hfBandLow = hfBandLow;
    this.hfBandHigh = hfBandHigh;
    this.sampleRate = sampleRate;
  }

  /**
   * Decode direction from a SourceStream.
   * @param {{ leftWaveform: Float32Array, rightWaveform: Float32Array }} source
   * @returns {{ direction: string, lrConfidence: number, fbConfidence: number, pan: number }}
   */
  decode(source) {
    const { leftWaveform, rightWaveform } = source;

    // Step 1 — ILD (left-right axis)
    const leftRms = this._rms(leftWaveform);
    const rightRms = this._rms(rightWaveform);
    const pan = (rightRms - leftRms) / (leftRms + rightRms + 1e-9);

    const lrBucket = this._classifyPan(pan);
    const lrConfidence = Math.abs(pan);

    // Step 2 — Front/Back (HF spectral cue on L+R combined)
    const combined = this._mix(leftWaveform, rightWaveform);
    const hfRatio = this._hfRatio(combined);
    const front = hfRatio > this.hfThreshold;
    const fbConfidence = Math.abs(hfRatio - 0.5) * 2; // 0=ambiguous, 1=certain

    // Step 3 — Map to 8 directions
    const direction = this._mapDirection(front, lrBucket, pan);

    return { direction, lrConfidence, fbConfidence, pan };
  }

  /**
   * Update HF threshold (per-game calibration).
   * @param {number} value
   */
  setHFThreshold(value) {
    this.hfThreshold = Math.max(0, Math.min(1, value));
  }

  // --- Private helpers ---

  _rms(signal) {
    let sum = 0;
    for (let i = 0; i < signal.length; i++) sum += signal[i] * signal[i];
    return Math.sqrt(sum / (signal.length || 1));
  }

  _mix(left, right) {
    const len = Math.min(left.length, right.length);
    const out = new Float32Array(len);
    for (let i = 0; i < len; i++) out[i] = (left[i] + right[i]) * 0.5;
    return out;
  }

  /**
   * Compute ratio of energy in HF band (hfBandLow–hfBandHigh) to total energy.
   * Uses a simple FFT-free approximation: bandpass via squared difference.
   * For accuracy, we use a DFT magnitude approximation at target frequencies.
   */
  _hfRatio(signal) {
    if (signal.length === 0) return 0;

    // Compute energy in HF band vs total using Goertzel-like estimation
    const N = signal.length;
    let totalEnergy = 0;
    let hfEnergy = 0;

    // Total energy
    for (let i = 0; i < N; i++) totalEnergy += signal[i] * signal[i];

    if (totalEnergy < 1e-12) return 0;

    // HF energy: estimate via bandpass using finite differences (approximates high-freq content)
    // Simple approach: correlate with cosines at band center
    const fCenter = (this.hfBandLow + this.hfBandHigh) / 2;
    const omega = (2 * Math.PI * fCenter) / this.sampleRate;
    let re = 0, im = 0;
    for (let i = 0; i < N; i++) {
      re += signal[i] * Math.cos(omega * i);
      im += signal[i] * Math.sin(omega * i);
    }
    hfEnergy = (re * re + im * im) / N;

    return hfEnergy / (totalEnergy + 1e-9);
  }

  /**
   * Classify pan value into L/R bucket.
   * @param {number} pan -1..+1
   * @returns {string}
   */
  _classifyPan(pan) {
    if (pan < -0.6) return 'hard_left';
    if (pan < -0.2) return 'left';
    if (pan < 0.2)  return 'center';
    if (pan < 0.6)  return 'right';
    return 'hard_right';
  }

  /**
   * Map front/back + LR bucket to one of 8 directions.
   */
  _mapDirection(front, lrBucket, pan) {
    // E and W from extreme pan regardless of FB
    if (pan > 0.85) return Direction.E;
    if (pan < -0.85) return Direction.W;

    if (front) {
      switch (lrBucket) {
        case 'hard_left':  return Direction.NW;
        case 'left':       return Direction.NW;
        case 'center':     return Direction.N;
        case 'right':      return Direction.NE;
        case 'hard_right': return Direction.NE;
      }
    } else {
      switch (lrBucket) {
        case 'hard_left':  return Direction.SW;
        case 'left':       return Direction.SW;
        case 'center':     return Direction.S;
        case 'right':      return Direction.SE;
        case 'hard_right': return Direction.SE;
      }
    }
    return Direction.N;
  }
}

module.exports = DirectionDecoder;
