const fs = require('fs');
const { EventCategory } = require('../../shared/constants');

const MEL_BINS = 128;
const TIME_FRAMES = 32;

class Classifier {
  /**
   * @param {{ modelPath: string, confidenceThreshold?: number }} opts
   */
  constructor({ modelPath, confidenceThreshold = 0.4 } = {}) {
    this.modelPath = modelPath;
    this.confidenceThreshold = confidenceThreshold;
    this._session = null;
    this._categories = [
      EventCategory.GUNSHOT,
      EventCategory.FOOTSTEP,
      EventCategory.EXPLOSION,
      EventCategory.ABILITY,
      EventCategory.RELOAD,
      EventCategory.ALERT,
      EventCategory.UNKNOWN,
    ];
  }

  /**
   * Load ONNX model. If model file is missing, logs warning and continues in degraded mode.
   */
  async init() {
    if (!this.modelPath || !fs.existsSync(this.modelPath)) {
      console.warn('[Classifier] Model file not found at', this.modelPath, '— running in degraded mode (always UNKNOWN)');
      return;
    }
    try {
      const ort = require('onnxruntime-node');
      this._session = await ort.InferenceSession.create(this.modelPath);
      console.log('[Classifier] ONNX model loaded from', this.modelPath);
    } catch (err) {
      console.warn('[Classifier] ONNX load error:', err.message, '— running in degraded mode');
      this._session = null;
    }
  }

  /**
   * Classify a STFTResult into an event category.
   * Input: 128 mel bins × 32 time frames Float32Array.
   * @param {{ melL: Float32Array, melR: Float32Array }} stftResult
   * @returns {{ category: string, confidence: number }}
   */
  classify(stftResult) {
    if (!this._session) {
      return { category: EventCategory.UNKNOWN, confidence: 0 };
    }

    try {
      const ort = require('onnxruntime-node');
      const { melL, melR } = stftResult;

      // Build input tensor: average L+R mel, take last 32 frames worth
      // melL is a flat Float32Array of melBins (averaged over frames from STFT)
      // Expand to 128×32 by repeating the mel vector across time frames
      const input = new Float32Array(MEL_BINS * TIME_FRAMES);
      for (let t = 0; t < TIME_FRAMES; t++) {
        for (let m = 0; m < MEL_BINS; m++) {
          const lVal = melL[m] || 0;
          const rVal = melR[m] || 0;
          input[t * MEL_BINS + m] = (lVal + rVal) * 0.5;
        }
      }

      // Run inference synchronously via async wrapper
      // (called from sync context — use a cached result approach)
      // Note: onnxruntime-node requires async — caller should use classifyAsync
      return { category: EventCategory.UNKNOWN, confidence: 0 };
    } catch (err) {
      console.warn('[Classifier] inference error:', err.message);
      return { category: EventCategory.UNKNOWN, confidence: 0 };
    }
  }

  /**
   * Async version of classify — preferred when ONNX session is available.
   * @param {{ melL: Float32Array, melR: Float32Array }} stftResult
   * @returns {Promise<{ category: string, confidence: number }>}
   */
  async classifyAsync(stftResult) {
    if (!this._session) {
      return { category: EventCategory.UNKNOWN, confidence: 0 };
    }

    try {
      const ort = require('onnxruntime-node');
      const { melL, melR } = stftResult;

      const input = new Float32Array(MEL_BINS * TIME_FRAMES);
      for (let t = 0; t < TIME_FRAMES; t++) {
        for (let m = 0; m < MEL_BINS; m++) {
          input[t * MEL_BINS + m] = ((melL[m] || 0) + (melR[m] || 0)) * 0.5;
        }
      }

      const tensor = new ort.Tensor('float32', input, [1, 1, TIME_FRAMES, MEL_BINS]);
      const feeds = { input: tensor };
      const results = await this._session.run(feeds);

      // Extract output — assume first output is softmax probabilities
      const outputKey = Object.keys(results)[0];
      const probs = results[outputKey].data;

      let maxProb = 0;
      let maxIdx = 6; // default UNKNOWN
      for (let i = 0; i < probs.length && i < this._categories.length; i++) {
        if (probs[i] > maxProb) {
          maxProb = probs[i];
          maxIdx = i;
        }
      }

      if (maxProb < this.confidenceThreshold) {
        return { category: EventCategory.UNKNOWN, confidence: maxProb };
      }

      return { category: this._categories[maxIdx], confidence: maxProb };
    } catch (err) {
      console.warn('[Classifier] async inference error:', err.message);
      return { category: EventCategory.UNKNOWN, confidence: 0 };
    }
  }
}

module.exports = Classifier;
