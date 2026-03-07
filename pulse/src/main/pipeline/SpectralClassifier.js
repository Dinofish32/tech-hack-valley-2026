const { EventCategory } = require('../../shared/constants');

/**
 * SpectralClassifier — real-time audio event classifier using handcrafted
 * spectral features computed from raw FFT power frames.
 *
 * No model file required. Tuned for Valorant game audio:
 * gunshots, footsteps, explosions, and abilities.
 *
 * Features used:
 *   - Spectral centroid       (where is most energy frequency-wise?)
 *   - Spectral flatness       (noise-like vs tonal?)
 *   - Sub-bass energy ratio   (60–350 Hz fraction)
 *   - High energy ratio       (2000–8000 Hz fraction)
 *   - Low-mid energy ratio    (350–2000 Hz fraction)
 *
 * Latency: <2ms (pure synchronous math on already-computed FFT data).
 */
class SpectralClassifier {
  /**
   * @param {{
   *   sampleRate?: number,
   *   fftSize?: number,
   *   confidenceThreshold?: number,
   *   thresholds?: object,
   * }} opts
   */
  constructor({
    sampleRate = 48000,
    fftSize = 1024,
    confidenceThreshold = 0.40,
    thresholds = {},
  } = {}) {
    this.sampleRate = sampleRate;
    this.fftSize = fftSize;
    this.confidenceThreshold = confidenceThreshold;
    this._binHz = sampleRate / fftSize; // Hz per FFT bin (~46.875 Hz at 48kHz/1024)

    // All thresholds are tunable — override via constants.js SPECTRAL_THRESHOLDS
    this.t = {
      // ── Gunshot: broadband impulsive noise, high centroid ──────────
      gunCentroidHz:  1800,  // centroid must exceed this (Hz)
      gunFlatness:    0.28,  // spectral flatness must exceed this
      gunHighRatio:   0.22,  // fraction of energy in 2–8 kHz band
      gunSubBassMax:  0.22,  // sub-bass fraction must be below this

      // ── Footstep: low-frequency thump ─────────────────────────────
      footCentroidHz:  650,  // centroid must be below this (Hz)
      footSubBassMin:  0.28, // sub-bass fraction must exceed this
      footHighMax:     0.22, // high-frequency fraction must be below this

      // ── Explosion: gunshot + low rumble ───────────────────────────
      explCentroidMin: 350,
      explCentroidMax: 2200,
      explFlatness:    0.22,
      explSubBassMin:  0.08,

      // ── Ability: tonal mid-range burst ────────────────────────────
      abilCentroidMin: 600,
      abilCentroidMax: 3500,

      ...thresholds,
    };
  }

  /**
   * Classify a STFTResult synchronously.
   * @param {{ powerL: Float32Array[], powerR: Float32Array[] }} stftResult
   * @returns {{ category: string, confidence: number }}
   */
  classify({ powerL, powerR }) {
    if (!powerL || powerL.length === 0) {
      return { category: EventCategory.UNKNOWN, confidence: 0 };
    }
    const spectrum  = this._avgSpectrum(powerL, powerR);
    const features  = this._extractFeatures(spectrum);
    return this._score(features);
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  /**
   * Average all power frames from both channels into one spectrum.
   * @param {Float32Array[]} powerL
   * @param {Float32Array[]} powerR
   * @returns {Float32Array}
   */
  _avgSpectrum(powerL, powerR) {
    const len   = powerL[0].length;
    const out   = new Float32Array(len);
    const allFrames = powerR ? [...powerL, ...powerR] : powerL;
    for (const frame of allFrames) {
      for (let i = 0; i < len; i++) out[i] += frame[i];
    }
    const n = allFrames.length;
    for (let i = 0; i < len; i++) out[i] /= n;
    return out;
  }

  /**
   * Extract the five discriminating features from a power spectrum.
   */
  _extractFeatures(spectrum) {
    const binHz = this._binHz;
    const len   = spectrum.length;

    let totalEnergy  = 0;
    let centroidNum  = 0;
    let subBassEnergy = 0; // 60–350 Hz
    let lowMidEnergy  = 0; // 350–2000 Hz
    let highEnergy    = 0; // 2000–8000 Hz
    let logSum        = 0;
    let validBins     = 0;

    for (let k = 1; k < len; k++) { // skip DC (k=0)
      const hz = k * binHz;
      const p  = spectrum[k];

      totalEnergy  += p;
      centroidNum  += hz * p;

      if (hz >= 60   && hz < 350)  subBassEnergy += p;
      if (hz >= 350  && hz < 2000) lowMidEnergy  += p;
      if (hz >= 2000 && hz < 8000) highEnergy    += p;

      if (p > 1e-12) { logSum += Math.log(p); validBins++; }
    }

    const safe = totalEnergy > 1e-12;
    const centroid     = safe ? centroidNum  / totalEnergy : 0;
    const subBassRatio = safe ? subBassEnergy / totalEnergy : 0;
    const highRatio    = safe ? highEnergy    / totalEnergy : 0;
    const lowMidRatio  = safe ? lowMidEnergy  / totalEnergy : 0;

    // Spectral flatness (Wiener entropy): geometric mean / arithmetic mean
    // Approaches 1 for white noise, 0 for pure tones.
    const geoMean   = validBins > 0 ? Math.exp(logSum / validBins) : 0;
    const arithMean = validBins > 0 ? totalEnergy / validBins : 0;
    const flatness  = arithMean > 1e-12 ? Math.min(1, geoMean / arithMean) : 0;

    return { centroid, flatness, subBassRatio, highRatio, lowMidRatio };
  }

  /**
   * Score each category and return the best match above confidenceThreshold.
   */
  _score({ centroid, flatness, subBassRatio, highRatio, lowMidRatio }) {
    const t = this.t;

    // ── GUNSHOT ───────────────────────────────────────────────────────
    // Valorant guns: Vandal/Phantom shots are broadband transients.
    // High centroid, high flatness, significant high-frequency energy.
    let gun = 0;
    if (centroid > t.gunCentroidHz)     gun += 0.35;
    if (flatness > t.gunFlatness)       gun += 0.30;
    if (highRatio > t.gunHighRatio)     gun += 0.20;
    if (subBassRatio < t.gunSubBassMax) gun += 0.15;

    // ── FOOTSTEP ──────────────────────────────────────────────────────
    // Enemy footsteps: low thump sound. Very concentrated in sub-bass.
    // Low centroid, high sub-bass ratio, minimal high-frequency content.
    let foot = 0;
    if (centroid < t.footCentroidHz)       foot += 0.40;
    if (subBassRatio > t.footSubBassMin)   foot += 0.35;
    if (highRatio < t.footHighMax)         foot += 0.15;
    if (flatness < 0.50)                   foot += 0.10; // footsteps aren't pure noise

    // ── EXPLOSION ─────────────────────────────────────────────────────
    // Raze ult, spike: like a gunshot but shifted lower with more rumble.
    let expl = 0;
    if (centroid > t.explCentroidMin && centroid < t.explCentroidMax) expl += 0.40;
    if (flatness > t.explFlatness)     expl += 0.30;
    if (subBassRatio > t.explSubBassMin && subBassRatio < 0.35)       expl += 0.20;
    if (lowMidRatio > 0.25)            expl += 0.10;
    // Penalise: if it more clearly matches gun or foot, it's not an explosion
    if (centroid > t.gunCentroidHz && subBassRatio < t.gunSubBassMax) expl *= 0.50;
    if (centroid < t.footCentroidHz)                                   expl *= 0.40;

    // ── ABILITY ───────────────────────────────────────────────────────
    // Sova dart, Brim smoke, etc: tonal mid-range bursts.
    // Wins by exclusion — only if it doesn't clearly match gun or foot.
    let abil = 0;
    if (centroid > t.abilCentroidMin && centroid < t.abilCentroidMax) abil += 0.30;
    if (flatness < 0.30)   abil += 0.20; // more tonal than gunshot
    if (lowMidRatio > 0.40) abil += 0.20;
    // Suppressed by strong gun or foot evidence
    abil *= (1 - Math.max(gun, foot) * 0.8);

    // ── Winner ────────────────────────────────────────────────────────
    const scores = {
      [EventCategory.GUNSHOT]:   gun,
      [EventCategory.FOOTSTEP]:  foot,
      [EventCategory.EXPLOSION]: expl,
      [EventCategory.ABILITY]:   abil,
    };

    let best      = EventCategory.UNKNOWN;
    let bestScore = this.confidenceThreshold; // must beat threshold to win

    for (const [cat, s] of Object.entries(scores)) {
      if (s > bestScore) { bestScore = s; best = cat; }
    }

    return { category: best, confidence: +bestScore.toFixed(3) };
  }
}

module.exports = SpectralClassifier;
