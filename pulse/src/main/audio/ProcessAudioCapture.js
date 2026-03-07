const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// wasapi_capture.exe sits at the project root (built by capture/build.bat)
const EXE_PATH = path.join(__dirname, '../../wasapi_capture.exe');

const BYTES_PER_SAMPLE = 4;           // float32
const CHANNELS         = 2;           // always L + R out
const BYTES_PER_FRAME  = CHANNELS * BYTES_PER_SAMPLE;
const CHUNK_FRAMES     = 512;
const CHUNK_BYTES      = CHUNK_FRAMES * BYTES_PER_FRAME;

/**
 * Captures audio from a specific Windows process using WASAPI Application
 * Loopback (wasapi_capture.exe).  Emits the same 'data' events as AudioCapture
 * so it is a drop-in replacement inside Pipeline.
 *
 * @fires ProcessAudioCapture#data  { left, right, sampleRate, timestamp }
 * @fires ProcessAudioCapture#error
 * @fires ProcessAudioCapture#stopped
 */
class ProcessAudioCapture extends EventEmitter {
  /**
   * @param {{ pid: number }} opts
   */
  constructor({ pid } = {}) {
    super();
    this._pid      = pid;
    this._proc     = null;
    this._leftover = Buffer.alloc(0);
    this.sampleRate = 48000; // updated when FORMAT line arrives on stderr
  }

  /** True when the compiled helper exe is present on disk. */
  static isAvailable() {
    return fs.existsSync(EXE_PATH);
  }

  start() {
    if (this._proc) return;

    this._proc = spawn(EXE_PATH, [String(this._pid)], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // stderr carries FORMAT and diagnostic lines
    this._proc.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      const m = text.match(/FORMAT:(\d+):(\d+):(\d+)/);
      if (m) {
        this.sampleRate = parseInt(m[1], 10);
        console.log(`[ProcessAudioCapture] PID ${this._pid} — ${m[1]} Hz, ch=${m[2]}, ${m[3]}-bit`);
      }
      // Forward other debug lines
      text.split('\n')
          .map(l => l.trim())
          .filter(l => l && !l.includes('FORMAT:'))
          .forEach(l => console.log('[wasapi]', l));
    });

    // stdout is raw interleaved float32 L R L R ...
    this._proc.stdout.on('data', (chunk) => {
      const buf = this._leftover.length > 0
        ? Buffer.concat([this._leftover, chunk])
        : chunk;

      let offset = 0;
      while (offset + CHUNK_BYTES <= buf.length) {
        const left  = new Float32Array(CHUNK_FRAMES);
        const right = new Float32Array(CHUNK_FRAMES);
        for (let i = 0; i < CHUNK_FRAMES; i++) {
          left[i]  = buf.readFloatLE(offset + i * BYTES_PER_FRAME);
          right[i] = buf.readFloatLE(offset + i * BYTES_PER_FRAME + BYTES_PER_SAMPLE);
        }
        this.emit('data', {
          left,
          right,
          sampleRate: this.sampleRate,
          timestamp:  Date.now(),
        });
        offset += CHUNK_BYTES;
      }

      this._leftover = buf.slice(offset);
    });

    this._proc.on('close', (code) => {
      this._proc     = null;
      this._leftover = Buffer.alloc(0);
      this.emit('stopped', code);
    });

    this._proc.on('error', (err) => {
      this.emit('error', err);
    });
  }

  stop() {
    if (this._proc) {
      this._proc.kill();
      this._proc = null;
    }
    this._leftover = Buffer.alloc(0);
  }
}

module.exports = ProcessAudioCapture;
