const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');

const AudioCapture = require('./AudioCapture');
const OnsetDetector = require('./OnsetDetector');
const STFT = require('./STFT');
const SourceSeparator = require('./SourceSeparator');
const DirectionDecoder = require('./DirectionDecoder');
const Classifier = require('./Classifier');
const PriorityArbiter = require('./PriorityArbiter');
const MotorCommandGenerator = require('./MotorCommandGenerator');
const { DEFAULT_PRIORITY } = require('../../shared/constants');

const TICK_INTERVAL_MS = 10;
const METRICS_INTERVAL_MS = 1000;
const LEVEL_INTERVAL_MS = 80;
const LATENCY_WINDOW = 100;

class Pipeline extends EventEmitter {
  /**
   * @param {Object} config PipelineConfig
   */
  constructor(config = {}) {
    super();
    this._config = this._mergeDefaults(config);
    this._running = false;
    this._tickTimer = null;
    this._metricsTimer = null;
    this._latencies = [];
    this._eventsPerSecWindow = [];
    this._suppressedPerSecWindow = [];
    this._onsetRateWindow = [];

    this._capture = null;
    this._currentLevel = 0;
    this._levelTimer = null;
    this._onsetDetector = null;
    this._stft = null;
    this._separator = null;
    this._decoder = null;
    this._classifier = null;
    this._arbiter = null;
    this._generator = null;
  }

  _mergeDefaults(config) {
    return {
      sampleRate: 48000,
      bufferSize: 2048,
      useOnnxSeparator: false,
      hfThreshold: 0.04,
      priorityMap: { ...DEFAULT_PRIORITY },
      enabledCategories: ['GUNSHOT', 'FOOTSTEP', 'EXPLOSION', 'ABILITY', 'RELOAD', 'ALERT', 'UNKNOWN'],
      confidenceThreshold: 0.4,
      modelPath: null,
      deviceIndex: null,
      ...config,
    };
  }

  async start() {
    if (this._running) return;

    try {
      const cfg = this._config;

      this._capture = new AudioCapture({
        sampleRate:  cfg.sampleRate,
        bufferSize:  cfg.bufferSize,
        deviceIndex: cfg.deviceIndex,
        gamePid:     cfg.gamePid || null,
      });

      this._onsetDetector = new OnsetDetector({
        threshold: 0.15,
        debounceMs: 30,
        sampleRate: cfg.sampleRate,
      });

      this._stft = new STFT({
        fftSize: 1024,
        hopSize: 256,
        sampleRate: cfg.sampleRate,
        melBins: 128,
      });

      this._separator = new SourceSeparator({
        maxSources: 3,
        useOnnx: cfg.useOnnxSeparator,
        modelPath: cfg.separatorModelPath || null,
      });
      await this._separator.init();

      this._decoder = new DirectionDecoder({
        hfThreshold: cfg.hfThreshold,
        sampleRate: cfg.sampleRate,
      });

      this._classifier = new Classifier({
        modelPath: cfg.modelPath,
        confidenceThreshold: cfg.confidenceThreshold,
      });
      await this._classifier.init();

      this._arbiter = new PriorityArbiter({
        staleMs: 500,
        cooldownMs: 100,
        footstepDedupeMs: 150,
      });
      this._arbiter.updatePriorityMap(cfg.priorityMap);

      this._generator = new MotorCommandGenerator({
        waveformOverrides: cfg.waveformOverrides || {},
      });

      // Wire audio capture → pipeline
      this._capture.on('data', (audioBuffer) => {
        this._processBuffer(audioBuffer);
      });

      this._capture.on('error', (err) => {
        console.error('[Pipeline] AudioCapture error:', err.message);
        this.emit('error', err);
      });

      await this._capture.start();

      // Tick arbiter every 10ms
      this._tickTimer = setInterval(() => {
        this._tick();
      }, TICK_INTERVAL_MS);

      // Emit audio level every 80ms for the UI indicator
      this._levelTimer = setInterval(() => {
        this.emit('level', this._currentLevel);
        this._currentLevel = 0; // reset peak
      }, LEVEL_INTERVAL_MS);

      // Emit metrics every 1s
      this._metricsTimer = setInterval(() => {
        this.emit('metrics', this.getMetrics());
      }, METRICS_INTERVAL_MS);

      this._running = true;
    } catch (err) {
      console.error('[Pipeline] start error:', err.message);
      this.emit('error', err);
      throw err;
    }
  }

  async stop() {
    this._running = false;

    if (this._tickTimer) {
      clearInterval(this._tickTimer);
      this._tickTimer = null;
    }
    if (this._levelTimer) {
      clearInterval(this._levelTimer);
      this._levelTimer = null;
    }
    if (this._metricsTimer) {
      clearInterval(this._metricsTimer);
      this._metricsTimer = null;
    }
    if (this._capture) {
      await this._capture.stop();
      this._capture = null;
    }
    if (this._arbiter) {
      this._arbiter.reset();
    }
    if (this._onsetDetector) {
      this._onsetDetector.reset();
    }
  }

  /**
   * Update pipeline config live.
   * @param {Object} partialConfig
   */
  updateConfig(partialConfig) {
    this._config = { ...this._config, ...partialConfig };
    if (this._decoder && partialConfig.hfThreshold != null) {
      this._decoder.setHFThreshold(partialConfig.hfThreshold);
    }
    if (this._arbiter && partialConfig.priorityMap) {
      this._arbiter.updatePriorityMap(partialConfig.priorityMap);
    }
    if (this._classifier && partialConfig.confidenceThreshold != null) {
      this._classifier.confidenceThreshold = partialConfig.confidenceThreshold;
    }
  }

  /**
   * Get current pipeline performance metrics.
   * @returns {Object} PipelineMetrics
   */
  getMetrics() {
    const now = Date.now();
    const windowMs = 1000;

    // Filter to last 1s
    const recentLatencies = this._latencies.filter(l => (now - l.ts) < windowMs).map(l => l.val);
    const avgLatencyMs = recentLatencies.length > 0
      ? recentLatencies.reduce((a, b) => a + b, 0) / recentLatencies.length
      : 0;

    const sorted = recentLatencies.slice().sort((a, b) => a - b);
    const p95Idx = Math.floor(sorted.length * 0.95);
    const p95LatencyMs = sorted[p95Idx] || 0;

    const eventsPerSec = this._eventsPerSecWindow.filter(t => (now - t) < windowMs).length;
    const suppressedPerSec = this._suppressedPerSecWindow.filter(t => (now - t) < windowMs).length;
    const onsetRate = this._onsetRateWindow.filter(t => (now - t) < windowMs).length;

    return { avgLatencyMs, p95LatencyMs, eventsPerSec, suppressedPerSec, onsetRate };
  }

  // --- Private ---

  _processBuffer(audioBuffer) {
    if (!this._running) return;
    try {
      const startMs = Date.now();

      // Track peak RMS for the audio level indicator
      const rms = this._computeRms(audioBuffer.left, audioBuffer.right);
      if (rms > this._currentLevel) this._currentLevel = rms;

      // Onset detection
      const onsets = this._onsetDetector.process(audioBuffer);
      if (onsets.length === 0) return;

      this._onsetRateWindow.push(Date.now());

      // STFT on the full buffer
      const stftResult = this._stft.process(audioBuffer);

      // Source separation
      const sources = this._separator.process(audioBuffer);

      // Process each source in parallel (async classification)
      for (const source of sources) {
        this._processSource(source, stftResult, audioBuffer.timestamp, startMs);
      }
    } catch (err) {
      console.error('[Pipeline] _processBuffer error:', err.message);
      this.emit('error', err);
    }
  }

  async _processSource(source, stftResult, captureTimestamp, startMs) {
    try {
      // Direction decode (sync)
      const dirResult = this._decoder.decode(source);

      // Classification (async ONNX or stub)
      const classResult = await this._classifier.classifyAsync(stftResult);

      // Check enabled categories
      if (!this._config.enabledCategories.includes(classResult.category)) return;

      // Compute RMS intensity
      const intensityRms = this._computeRms(source.leftWaveform, source.rightWaveform);

      // Gate: ignore near-silent buffers (ambient noise false triggers)
      if (intensityRms < 0.003) return;

      // Assemble AudioEvent
      const event = {
        id: this._uuid(),
        direction: dirResult.direction,
        category: classResult.category,
        confidence: classResult.confidence,
        intensityRms,
        priority: this._config.priorityMap[classResult.category] || 4,
        timestamp: captureTimestamp,
      };

      // Submit to arbiter
      this._arbiter.submit(event);
    } catch (err) {
      console.error('[Pipeline] _processSource error:', err.message);
    }
  }

  _tick() {
    if (!this._arbiter || !this._generator) return;
    try {
      const events = this._arbiter.tick();
      const now = Date.now();

      for (const event of events) {
        try {
          const command = this._generator.generate(event);
          const latencyMs = now - event.timestamp;

          // Record latency
          this._latencies.push({ ts: now, val: latencyMs });
          if (this._latencies.length > LATENCY_WINDOW * 10) {
            this._latencies.splice(0, this._latencies.length - LATENCY_WINDOW);
          }

          this._eventsPerSecWindow.push(now);

          // Performance guard: auto-switch to lightweight if latency > 50ms
          if (latencyMs > 50 && this._config.useOnnxSeparator) {
            console.warn('[Pipeline] Latency exceeded 50ms, switching to lightweight mode');
            this.updateConfig({ useOnnxSeparator: false });
          }

          this.emit('command', command);
          this.emit('event', event);
        } catch (err) {
          console.error('[Pipeline] tick event error:', err.message);
        }
      }

      // Cleanup old window entries
      const cutoff = Date.now() - 2000;
      this._onsetRateWindow = this._onsetRateWindow.filter(t => t > cutoff);
      this._eventsPerSecWindow = this._eventsPerSecWindow.filter(t => t > cutoff);
      this._suppressedPerSecWindow = this._suppressedPerSecWindow.filter(t => t > cutoff);
    } catch (err) {
      console.error('[Pipeline] tick error:', err.message);
    }
  }

  _computeRms(left, right) {
    let sum = 0;
    const len = Math.min(left.length, right.length);
    for (let i = 0; i < len; i++) {
      const s = (left[i] + right[i]) * 0.5;
      sum += s * s;
    }
    return Math.sqrt(sum / (len || 1));
  }

  _uuid() {
    try {
      return uuidv4();
    } catch {
      return Math.random().toString(36).slice(2);
    }
  }
}

module.exports = Pipeline;
