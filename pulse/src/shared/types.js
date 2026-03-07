/**
 * JSDoc type definitions for Puls8 pipeline data structures.
 * TypeScript is not used — plain JS with JSDoc.
 */

/** Raw stereo audio buffer from loopback capture
 * @typedef {{ left: Float32Array, right: Float32Array, sampleRate: number, timestamp: number }} AudioBuffer
 */

/** Output of onset detector
 * @typedef {{ detected: boolean, timestamp: number, frame: Float32Array }} OnsetResult
 */

/** Output of STFT module
 * @typedef {{ melL: Float32Array, melR: Float32Array, powerL: Float32Array[], powerR: Float32Array[], hopCount: number }} STFTResult
 */

/** One separated source stream
 * @typedef {{ leftWaveform: Float32Array, rightWaveform: Float32Array, sourceIndex: number }} SourceStream
 */

/** Output of direction decoder
 * @typedef {{ direction: string, lrConfidence: number, fbConfidence: number, pan: number }} DirectionResult
 */

/** Output of classifier
 * @typedef {{ category: string, confidence: number }} ClassificationResult
 */

/** A fully processed audio event before arbitration
 * @typedef {{ id: string, direction: string, category: string, confidence: number, intensityRms: number, priority: number, timestamp: number }} AudioEvent
 */

/** Motor command packet — final output of pipeline
 * @typedef {{ motors: { N: number, E: number, S: number, W: number }, waveform: string, durationMs: number, intensityScale: number, timestamp: number }} MotorCommand
 */

/** Pipeline configuration
 * @typedef {{ sampleRate: number, bufferSize: number, useOnnxSeparator: boolean, hfThreshold: number, priorityMap: Object, enabledCategories: string[], confidenceThreshold: number }} PipelineConfig
 */

/** Pipeline performance metrics
 * @typedef {{ avgLatencyMs: number, p95LatencyMs: number, eventsPerSec: number, suppressedPerSec: number, onsetRate: number }} PipelineMetrics
 */

module.exports = {};
