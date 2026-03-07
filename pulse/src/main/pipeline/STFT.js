const FFT = require('fft.js');

class STFT {
  /**
   * @param {{ fftSize?: number, hopSize?: number, sampleRate?: number, melBins?: number }} opts
   */
  constructor({ fftSize = 1024, hopSize = 256, sampleRate = 48000, melBins = 128 } = {}) {
    this.fftSize = fftSize;
    this.hopSize = hopSize;
    this.sampleRate = sampleRate;
    this.melBins = melBins;
    this._fft = new FFT(fftSize);
    this._hannWindow = this._buildHann(fftSize);
    this._melFilterbank = this._buildMelFilterbank(melBins, fftSize, sampleRate, 0, 12000);
  }

  /**
   * Process an AudioBuffer into mel spectrograms.
   * @param {{ left: Float32Array, right: Float32Array, sampleRate: number }} audioBuffer
   * @returns {{ melL: Float32Array, melR: Float32Array, powerL: Float32Array[], powerR: Float32Array[], hopCount: number }}
   */
  process(audioBuffer) {
    const { left, right } = audioBuffer;
    const powerL = this._computePowerFrames(left);
    const powerR = this._computePowerFrames(right);
    const melL = this._applyMelFilterbank(powerL);
    const melR = this._applyMelFilterbank(powerR);
    return { melL, melR, powerL, powerR, hopCount: powerL.length };
  }

  /**
   * Compute power spectrum frames from a mono signal.
   * @param {Float32Array} signal
   * @returns {Float32Array[]} Array of power spectra (fftSize/2 + 1 bins each)
   */
  _computePowerFrames(signal) {
    const frames = [];
    const out = this._fft.createComplexArray();
    for (let start = 0; start + this.fftSize <= signal.length; start += this.hopSize) {
      const windowed = new Array(this.fftSize * 2).fill(0);
      for (let i = 0; i < this.fftSize; i++) {
        windowed[i * 2] = signal[start + i] * this._hannWindow[i];
        windowed[i * 2 + 1] = 0;
      }
      this._fft.transform(out, windowed);
      const power = new Float32Array(this.fftSize / 2 + 1);
      for (let k = 0; k <= this.fftSize / 2; k++) {
        const re = out[k * 2];
        const im = out[k * 2 + 1];
        power[k] = re * re + im * im;
      }
      frames.push(power);
    }
    // Return at least one empty frame if signal too short
    if (frames.length === 0) {
      frames.push(new Float32Array(this.fftSize / 2 + 1));
    }
    return frames;
  }

  /**
   * Apply mel filterbank to power frames and return averaged mel vector.
   * @param {Float32Array[]} powerFrames
   * @returns {Float32Array} melBins-length vector
   */
  _applyMelFilterbank(powerFrames) {
    const mel = new Float32Array(this.melBins);
    for (const frame of powerFrames) {
      for (let m = 0; m < this.melBins; m++) {
        const { start, center, end } = this._melFilterbank[m];
        let energy = 0;
        for (let k = start; k <= end; k++) {
          const weight = k <= center
            ? (k - start) / (center - start + 1e-9)
            : (end - k) / (end - center + 1e-9);
          energy += frame[k] * weight;
        }
        mel[m] += energy;
      }
    }
    if (powerFrames.length > 0) {
      for (let m = 0; m < this.melBins; m++) mel[m] /= powerFrames.length;
    }
    return mel;
  }

  /**
   * Build Hann window.
   * @param {number} size
   * @returns {Float32Array}
   */
  _buildHann(size) {
    const w = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
    }
    return w;
  }

  /**
   * Build triangular mel filterbank.
   * @param {number} numBins
   * @param {number} fftSize
   * @param {number} sampleRate
   * @param {number} fMin Hz
   * @param {number} fMax Hz
   * @returns {Array<{start:number, center:number, end:number}>}
   */
  _buildMelFilterbank(numBins, fftSize, sampleRate, fMin, fMax) {
    const hzToMel = (hz) => 2595 * Math.log10(1 + hz / 700);
    const melToHz = (mel) => 700 * (Math.pow(10, mel / 2595) - 1);
    const freqToFFTBin = (hz) => Math.round((hz * fftSize) / sampleRate);

    const melMin = hzToMel(fMin);
    const melMax = hzToMel(fMax);
    const melPoints = [];
    for (let i = 0; i <= numBins + 1; i++) {
      melPoints.push(melMin + (i / (numBins + 1)) * (melMax - melMin));
    }
    const hzPoints = melPoints.map(melToHz);
    const binPoints = hzPoints.map(freqToFFTBin);

    const filters = [];
    for (let m = 1; m <= numBins; m++) {
      filters.push({
        start: binPoints[m - 1],
        center: binPoints[m],
        end: binPoints[m + 1],
      });
    }
    return filters;
  }
}

module.exports = STFT;
