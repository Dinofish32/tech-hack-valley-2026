const FFT = require('fft.js');
const path = require('path');
const fs = require('fs');

const NMF_COMPONENTS = 6; // spectral basis components
const NMF_ITERATIONS = 50;
const FFT_SIZE = 1024;
const HOP_SIZE = 256;

class SourceSeparator {
  /**
   * @param {{ maxSources?: number, useOnnx?: boolean, modelPath?: string|null }} opts
   */
  constructor({ maxSources = 3, useOnnx = false, modelPath = null } = {}) {
    this.maxSources = maxSources;
    this.useOnnx = useOnnx;
    this.modelPath = modelPath;
    this._onnxSession = null;
    this._fft = new FFT(FFT_SIZE);
    this._W = null; // NMF spectral bases [freqBins x K]
    this._nmfK = NMF_COMPONENTS;
  }

  async init() {
    if (this.useOnnx && this.modelPath) {
      try {
        const ort = require('onnxruntime-node');
        this._onnxSession = await ort.InferenceSession.create(this.modelPath);
        console.log('[SourceSeparator] ONNX model loaded');
      } catch (err) {
        console.warn('[SourceSeparator] ONNX load failed, using NMF fallback:', err.message);
        this._onnxSession = null;
      }
    }
    this._W = this._initNmfW();
  }

  /**
   * Separate sources from a stereo AudioBuffer.
   * @param {{ left: Float32Array, right: Float32Array, sampleRate: number }} audioBuffer
   * @returns {Array<{ leftWaveform: Float32Array, rightWaveform: Float32Array, sourceIndex: number }>}
   */
  process(audioBuffer) {
    try {
      if (this._onnxSession) {
        return this._separateOnnx(audioBuffer);
      }
      return this._separateNmf(audioBuffer);
    } catch (err) {
      console.warn('[SourceSeparator] process error, returning mixed as single source:', err.message);
      return [{
        leftWaveform: audioBuffer.left,
        rightWaveform: audioBuffer.right,
        sourceIndex: 0,
      }];
    }
  }

  // --- NMF fallback ---

  /**
   * NMF-based source separation.
   */
  _separateNmf(audioBuffer) {
    const { left, right } = audioBuffer;
    const len = Math.min(left.length, right.length);

    // Mix to mono for NMF
    const mono = new Float32Array(len);
    for (let i = 0; i < len; i++) mono[i] = (left[i] + right[i]) * 0.5;

    // Compute power spectrogram
    const frames = this._computeSTFT(mono);
    if (frames.length === 0) {
      return [{ leftWaveform: left, rightWaveform: right, sourceIndex: 0 }];
    }

    const freqBins = frames[0].length;
    const T = frames.length;
    const K = Math.min(this._nmfK, this.maxSources * 2);

    // V matrix [freqBins x T]
    const V = frames; // array of Float32Array(freqBins)

    // Init W [freqBins x K] and H [K x T] with small random values
    const W = this._W || this._initNmfW(freqBins, K);
    const H = [];
    for (let k = 0; k < K; k++) {
      H.push(new Float32Array(T).fill(0.1 + Math.random() * 0.1));
    }

    // NMF multiplicative updates
    for (let iter = 0; iter < NMF_ITERATIONS; iter++) {
      this._nmfUpdate(V, W, H, freqBins, K, T);
    }

    // Reconstruct each component as a Wiener mask, iSTFT to waveform
    const sources = [];
    const numSources = Math.min(this.maxSources, K);

    // Compute total reconstruction for Wiener mask denominator
    const totalPower = [];
    for (let t = 0; t < T; t++) {
      const total = new Float32Array(freqBins);
      for (let k = 0; k < K; k++) {
        for (let f = 0; f < freqBins; f++) {
          total[f] += W[f][k] * H[k][t];
        }
      }
      totalPower.push(total);
    }

    // Compute pan ratio for each frame for L/R reconstruction
    const panRatios = this._computePanRatios(left, right, T, freqBins);

    for (let srcIdx = 0; srcIdx < numSources; srcIdx++) {
      // Components 0..maxSources-1
      const k = srcIdx;

      // Wiener mask per frame
      const maskedMono = new Float32Array(T * HOP_SIZE);
      for (let t = 0; t < T; t++) {
        for (let f = 0; f < freqBins; f++) {
          const num = W[f][k] * H[k][t];
          const den = totalPower[t][f] + 1e-9;
          // Apply mask to frame: weight mono frame spectrum by mask
          // (we use amplitude approximation: masked_frame[f] ≈ V[t][f] * mask)
          // Simplified: reconstruct time-domain via overlap-add of masked power
        }
        // Simple approximation: scale time-domain segment by component energy ratio
        const startSample = t * HOP_SIZE;
        const compEnergy = H[k][t];
        let totalEnergy = 0;
        for (let k2 = 0; k2 < K; k2++) totalEnergy += H[k2][t];
        const scale = totalEnergy > 0 ? compEnergy / totalEnergy : 1 / numSources;
        for (let s = 0; s < HOP_SIZE && startSample + s < len; s++) {
          maskedMono[startSample + s] = mono[startSample + s] * scale;
        }
      }

      // Reconstruct L/R from pan ratio
      const monoLen = Math.min(maskedMono.length, len);
      const leftWaveform = new Float32Array(monoLen);
      const rightWaveform = new Float32Array(monoLen);
      for (let i = 0; i < monoLen; i++) {
        const pan = panRatios[i] || 0; // -1..+1
        const rGain = (pan + 1) / 2;
        const lGain = 1 - rGain;
        leftWaveform[i] = maskedMono[i] * lGain * 2;
        rightWaveform[i] = maskedMono[i] * rGain * 2;
      }

      sources.push({ leftWaveform, rightWaveform, sourceIndex: srcIdx });
    }

    return sources.length > 0 ? sources : [{ leftWaveform: left, rightWaveform: right, sourceIndex: 0 }];
  }

  /**
   * Compute per-sample pan ratio from original stereo signal.
   */
  _computePanRatios(left, right, T, freqBins) {
    const len = Math.min(left.length, right.length);
    const ratios = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const l = Math.abs(left[i]);
      const r = Math.abs(right[i]);
      ratios[i] = (r - l) / (l + r + 1e-9);
    }
    return ratios;
  }

  /**
   * One step of NMF multiplicative updates.
   */
  _nmfUpdate(V, W, H, freqBins, K, T) {
    const eps = 1e-9;

    // Update H: H = H * (W^T V) / (W^T W H)
    for (let k = 0; k < K; k++) {
      for (let t = 0; t < T; t++) {
        let num = 0, den = 0;
        for (let f = 0; f < freqBins; f++) {
          // WH approximation at (f,t)
          let wh = 0;
          for (let k2 = 0; k2 < K; k2++) wh += W[f][k2] * H[k2][t];
          num += W[f][k] * V[t][f];
          den += W[f][k] * (wh + eps);
        }
        H[k][t] = H[k][t] * (num + eps) / (den + eps);
      }
    }

    // Update W: W = W * (V H^T) / (W H H^T)
    for (let f = 0; f < freqBins; f++) {
      for (let k = 0; k < K; k++) {
        let num = 0, den = 0;
        for (let t = 0; t < T; t++) {
          let wh = 0;
          for (let k2 = 0; k2 < K; k2++) wh += W[f][k2] * H[k2][t];
          num += V[t][f] * H[k][t];
          den += (wh + eps) * H[k][t];
        }
        W[f][k] = W[f][k] * (num + eps) / (den + eps);
      }
    }
  }

  /**
   * Compute power spectrogram frames.
   * @param {Float32Array} mono
   * @returns {Float32Array[]}
   */
  _computeSTFT(mono) {
    const frames = [];
    const out = this._fft.createComplexArray();
    const freqBins = FFT_SIZE / 2 + 1;
    for (let start = 0; start + FFT_SIZE <= mono.length; start += HOP_SIZE) {
      const input = new Array(FFT_SIZE * 2).fill(0);
      for (let i = 0; i < FFT_SIZE; i++) {
        // Hann window
        const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));
        input[i * 2] = mono[start + i] * w;
      }
      this._fft.transform(out, input);
      const power = new Float32Array(freqBins);
      for (let k = 0; k < freqBins; k++) {
        const re = out[k * 2], im = out[k * 2 + 1];
        power[k] = re * re + im * im;
      }
      frames.push(power);
    }
    return frames;
  }

  /**
   * Init NMF W matrix with small random values.
   * @returns {Array<Float32Array>} W[freqBins][K]
   */
  _initNmfW(freqBins = FFT_SIZE / 2 + 1, K = NMF_COMPONENTS) {
    const W = [];
    for (let f = 0; f < freqBins; f++) {
      W.push(new Float32Array(K).map(() => 0.1 + Math.random() * 0.1));
    }
    return W;
  }

  // --- ONNX separator (when available) ---
  async _separateOnnx(audioBuffer) {
    // Placeholder — full implementation requires GPU + proper model
    console.warn('[SourceSeparator] ONNX path not fully implemented, falling back to NMF');
    return this._separateNmf(audioBuffer);
  }
}

module.exports = SourceSeparator;
