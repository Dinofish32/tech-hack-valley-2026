const { Direction } = require('../../shared/constants');
const FFT = require('fft.js');

const FFT_SIZE = 1024;

class DirectionDecoder {
  /**
   * @param {{ hfThreshold?: number, sampleRate?: number }} opts
   *
   * hfThreshold: ratio of energy in 6–12 kHz vs 2–12 kHz that separates
   * front (higher HF slope) from back (HRTF pinna notch reduces HF).
   * Start at 0.30 and tune from [DD] logs.
   */
  constructor({ hfThreshold = 0.20, sampleRate = 48000 } = {}) {
    this.hfThreshold = hfThreshold;
    this.sampleRate = sampleRate;
    this._fft = new FFT(FFT_SIZE);
    this._fftOut = this._fft.createComplexArray();

    // Precompute Hann window
    this._hann = new Float32Array(FFT_SIZE);
    for (let i = 0; i < FFT_SIZE; i++) {
      this._hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));
    }

    // Precompute frequency-band bin boundaries (based on sampleRate)
    const binHz = sampleRate / FFT_SIZE;
    this._loA = Math.max(1, Math.floor(2000 / binHz));  // 2 kHz
    this._hiA = Math.floor(6000 / binHz);               // 6 kHz
    this._loB = this._hiA;                               // 6 kHz
    this._hiB = Math.min(Math.floor(12000 / binHz), FFT_SIZE / 2); // 12 kHz
  }

  /**
   * Decode direction from a SourceStream.
   * @param {{ leftWaveform: Float32Array, rightWaveform: Float32Array }} source
   * @returns {{ direction: string, lrConfidence: number, fbConfidence: number, pan: number }}
   */
  decode(source) {
    const { leftWaveform, rightWaveform } = source;

    // Step 1 — Broadband ILD (left-right axis)
    const leftRms  = this._rms(leftWaveform);
    const rightRms = this._rms(rightWaveform);
    const pan = (rightRms - leftRms) / (leftRms + rightRms + 1e-9);
    const lrBucket = this._classifyPan(pan);
    const lrConfidence = Math.abs(pan);

    // Step 2 — HF spectral slope per ear (6–12 kHz / 2–12 kHz energy ratio)
    // Front sounds: pinna boosts 6–10 kHz → higher slope
    // Back sounds:  pinna notch at 8–10 kHz → lower slope
    const slopeL = this._hfSlope(leftWaveform);
    const slopeR = this._hfSlope(rightWaveform);
    const hfMean  = (slopeL + slopeR) * 0.5;
    const hfAsym  = slopeL - slopeR; // +ve = L more HF-rich; useful for side cues

    // Exponential moving average — equal weight so it tracks quickly but smooths spikes
    if (this._hfEma === undefined) this._hfEma = hfMean;
    this._hfEma = this._hfEma * 0.5 + hfMean * 0.5;

    const front = this._hfEma > this.hfThreshold;
    const fbConfidence = Math.abs(hfMean - this.hfThreshold);

    // Step 3 — Map to 8 directions
    const direction = this._mapDirection(front, lrBucket, pan);

    if (this._lastDebugTs === undefined) this._lastDebugTs = 0;
    const now = Date.now();
    if (now - this._lastDebugTs >= 2000) {
      this._lastDebugTs = now;
      console.log(
        `[DD] pan=${pan.toFixed(3)} bucket=${lrBucket}` +
        ` slopeL=${slopeL.toFixed(4)} slopeR=${slopeR.toFixed(4)}` +
        ` hfMean=${hfMean.toFixed(4)} ema=${this._hfEma.toFixed(4)} asym=${hfAsym.toFixed(4)}` +
        ` thr=${this.hfThreshold} front=${front} → ${direction}`
      );
    }

    return { direction, lrConfidence, fbConfidence, pan };
  }

  /** Update HF threshold for live calibration. */
  setHFThreshold(value) {
    this.hfThreshold = Math.max(0, Math.min(1, value));
  }

  // --- Private helpers ---

  _rms(signal) {
    let sum = 0;
    for (let i = 0; i < signal.length; i++) sum += signal[i] * signal[i];
    return Math.sqrt(sum / (signal.length || 1));
  }

  /**
   * Compute energy ratio: E(6–12 kHz) / E(2–12 kHz) using a windowed FFT.
   * Higher value = more high-frequency content = likely front (pinna boost).
   * Lower value  = HF attenuated = likely back (pinna notch) or occluded.
   */
  _hfSlope(signal) {
    // Build windowed input (reuse preallocated output buffer)
    const input = new Array(FFT_SIZE * 2).fill(0);
    const len = Math.min(signal.length, FFT_SIZE);
    for (let i = 0; i < len; i++) {
      input[i * 2] = signal[i] * this._hann[i];
    }

    this._fft.transform(this._fftOut, input);

    let eLo = 0; // 2–6 kHz
    let eHi = 0; // 6–12 kHz
    for (let k = this._loA; k < this._hiA; k++) {
      const re = this._fftOut[k * 2], im = this._fftOut[k * 2 + 1];
      eLo += re * re + im * im;
    }
    for (let k = this._loB; k < this._hiB; k++) {
      const re = this._fftOut[k * 2], im = this._fftOut[k * 2 + 1];
      eHi += re * re + im * im;
    }

    const total = eLo + eHi;
    return total < 1e-12 ? 0 : eHi / total;
  }

  /**
   * Classify pan value into L/R bucket.
   * @param {number} pan -1..+1
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
    if (pan > 0.85) return Direction.E;
    if (pan < -0.85) return Direction.W;

    if (front) {
      switch (lrBucket) {
        case 'hard_left':
        case 'left':       return Direction.NW;
        case 'center':     return Direction.N;
        case 'right':
        case 'hard_right': return Direction.NE;
      }
    } else {
      switch (lrBucket) {
        case 'hard_left':
        case 'left':       return Direction.SW;
        case 'center':     return Direction.S;
        case 'right':
        case 'hard_right': return Direction.SE;
      }
    }
    return Direction.N;
  }
}

module.exports = DirectionDecoder;
